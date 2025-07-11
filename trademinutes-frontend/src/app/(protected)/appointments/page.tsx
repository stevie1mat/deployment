"use client";

import { useEffect, useState } from "react";
import ProtectedLayout from "@/components/Layout/ProtectedLayout";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Appointment {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  status: "upcoming" | "past";
  taskId?: string;
  taskOwnerId?: string;
  taskOwnerEmail?: string;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageModal, setMessageModal] = useState<{ open: boolean; appt: Appointment | null }>({ open: false, appt: null });
  const [firstMessage, setFirstMessage] = useState("");
  const [sendingFirstMessage, setSendingFirstMessage] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; message: string; isError?: boolean }>({ open: false, message: "", isError: false });
  const router = useRouter();
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_TASK_API_URL || "http://localhost:8084";

  useEffect(() => {
    const fetchAppointments = async () => {
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.log("No token found");
        setLoading(false);
        return;
      }

      try {
        // Get user ID from profile
        let userId;
        try {
          const profileRes = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:8080'}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!profileRes.ok) throw new Error("Failed to fetch user profile");
          const profileData = await profileRes.json();
          userId = profileData.ID || profileData.id;
          if (!userId) throw new Error("User ID not found in profile");
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setLoading(false);
          return;
        }
        // Fetch bookings
        const res = await fetch(
          `${API_BASE_URL}/api/bookings?role=owner&id=${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) throw new Error(`Failed to fetch appointments: ${res.status}`);

        const json = await res.json();
        console.log("Raw appointments API response:", json);
        
        const now = new Date();

        // Fetch task details for each booking
        const bookings = (json.data || json || []);
        const appointmentsWithTasks = await Promise.all(bookings.map(async (item: any, idx: number) => {
          // Try to get date/time from booking first
          let dateStr = item.Timeslot?.date || null;
          let from = item.Timeslot?.timeFrom || null;
          let to = item.Timeslot?.timeTo || null;
          let title = "(No title)";
          let location = "(No location)";
          let taskId: string | undefined;
          let taskOwnerId: string | undefined;
          let taskOwnerEmail: string | undefined;
          // Fetch task details if TaskID is present
          if (item.TaskID) {
            try {
              const taskRes = await fetch(`${API_BASE_URL}/api/tasks/get/${item.TaskID}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (taskRes.ok) {
                const taskData = await taskRes.json();
                title = taskData.Title || taskData.title || title;
                location = taskData.Location || taskData.location || location;
                taskId = taskData.ID || taskData.$oid;
                // Extract owner info from Author field
                taskOwnerId = taskData.Author?.ID || taskData.Author?.id;
                taskOwnerEmail = taskData.Author?.Email || taskData.Author?.email;
                // Fallback: If booking is missing date/time, use task availability[0]
                if (!dateStr || !from || !to) {
                  dateStr = taskData.Availability?.[0]?.Date || null;
                  from = taskData.Availability?.[0]?.TimeFrom || null;
                  to = taskData.Availability?.[0]?.TimeTo || null;
                }
              }
            } catch (err) {
              console.warn("Failed to fetch task details for booking", item.TaskID, err);
            }
          }
          // If still missing, set to N/A
          dateStr = dateStr || "N/A";
          from = from || "-";
          to = to || "-";
          const dateTime = new Date(`${dateStr}T${from}`);
          const isUpcoming = dateTime.getTime() > now.getTime();

          return {
            id: item.ID || idx,
            title,
            date: dateStr,
            time: `${from} - ${to}`,
            location,
            status: isUpcoming ? "upcoming" : "past",
            taskId,
            taskOwnerId,
            taskOwnerEmail,
          };
        }));
        console.log("Formatted appointments:", appointmentsWithTasks);
        setAppointments(appointmentsWithTasks);
      } catch (err) {
        console.error("Failed to fetch appointments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  const upcoming = appointments.filter((a) => a.status === "upcoming");
  const past = appointments.filter((a) => a.status === "past");

  async function handleSendFirstMessage(appt: any) {
    if (!appt || !appt.taskId || !appt.taskOwnerId) {
      setDialog({ open: true, message: "No task or owner info found.", isError: true });
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    let currentUserEmail = null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUserEmail = payload.email;
      } catch {}
    }
    if (!token || !currentUserEmail) {
      setDialog({
        open: true,
        message: `You must be logged in to message.`,
        isError: true
      });
      return;
    }
    if (!firstMessage.trim()) {
      setDialog({ open: true, message: "Please enter a message.", isError: true });
      return;
    }
    setSendingFirstMessage(true);
    try {
      // 1. Create/find conversation
      const res = await fetch(`${process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'http://localhost:8085'}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: "direct",
          name: `Task: ${appt.title}`,
          avatar: "",
          participants: [currentUserEmail, appt.taskOwnerEmail].sort(),
          taskId: appt.taskId
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        setDialog({ open: true, message: `Failed to start conversation: ${errorText}`, isError: true });
        setSendingFirstMessage(false);
        return;
      }
      const data = await res.json();
      const conversationId = data.$oid || data || "";
      if (typeof window !== 'undefined') {
        sessionStorage.setItem("autoSelectConversationId", conversationId);
      }
      // 2. Send first message
      const messageRes = await fetch(`${process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'http://localhost:8085'}/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: firstMessage,
          senderId: currentUserEmail,
          senderName: "",
          senderAvatar: "",
          type: "text"
        })
      });
      if (!messageRes.ok) {
        const errorText = await messageRes.text();
        setDialog({ open: true, message: `Failed to send message: ${errorText}`, isError: true });
        setSendingFirstMessage(false);
        return;
      }
      setDialog({ open: true, message: "Message sent! Redirecting to chat...", isError: false });
      setTimeout(() => {
        setDialog({ open: false, message: "", isError: false });
        setMessageModal({ open: false, appt: null });
        setFirstMessage("");
        setSendingFirstMessage(false);
        router.push("/messages");
      }, 1200);
    } catch (err) {
      setDialog({ open: true, message: `Error: ${err instanceof Error ? err.message : String(err)}` , isError: true });
      setSendingFirstMessage(false);
    }
  }

  return (
    <ProtectedLayout>
      <div className="max-w-5xl pl-8 py-10 space-y-10">
        {loading ? (
          <div className="text-gray-500">Loading appointments...</div>
        ) : (
          <>
            <section>
              <h2 className="text-2xl font-bold mb-4">Your Appointments</h2>
              {appointments.length === 0 ? (
                <div className="text-gray-500">No appointments found.</div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appt, idx) => {
                    console.log("Appointment for button:", appt);
                    return (
                      <div
                        key={appt.id || `${appt.title}-${appt.date}-${appt.time}-${idx}`}
                        className="bg-white/80 rounded-xl shadow p-5 border border-gray-200 flex flex-col md:flex-row md:items-center gap-4"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-lg text-gray-700">
                            {appt.title}
                          </div>
                          <div className="text-gray-600 text-sm mb-1">
                            📍 {appt.location}
                          </div>
                          <div className="text-gray-500 text-sm">
                            <strong>Date:</strong> {appt.date || "N/A"}<br />
                            <strong>Time:</strong> {appt.time || "-"}
                          </div>
                        </div>
                        {/* Chat button if taskId and taskOwnerId are present */}
                        {appt.taskId && appt.taskOwnerId && appt.taskOwnerEmail && (
                          <button
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-2 md:mt-0"
                            onClick={() => setMessageModal({ open: true, appt: appt })}
                          >
                            💬 Message About This Task
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            {/* Message Modal */}
            {messageModal.open && messageModal.appt && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                <div className="bg-white rounded-xl shadow-lg p-8 min-w-[320px] text-center border border-blue-400">
                  <div className="mb-2 text-lg font-semibold text-blue-600">Send a message about this task</div>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-2 mb-4 min-h-[80px]"
                    placeholder="Type your message..."
                    value={firstMessage}
                    onChange={e => setFirstMessage(e.target.value)}
                    disabled={sendingFirstMessage}
                  />
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => { setMessageModal({ open: false, appt: null }); setFirstMessage(""); }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      disabled={sendingFirstMessage}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSendFirstMessage(messageModal.appt)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      disabled={sendingFirstMessage}
                    >
                      {sendingFirstMessage ? "Sending..." : "Send & Start Chat"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Dialog for errors/success */}
            {dialog.open && (
              <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30`}>
                <div className={`bg-white rounded-xl shadow-lg p-8 min-w-[320px] text-center border ${dialog.isError ? 'border-red-400' : 'border-green-400'}`}>
                  <div className={`mb-2 text-lg font-semibold ${dialog.isError ? 'text-red-600' : 'text-green-600'}`}>{dialog.isError ? 'Error' : 'Success'}</div>
                  <div className="mb-4 text-gray-700">{dialog.message}</div>
                  {!sendingFirstMessage && dialog.isError && (
                    <button onClick={() => setDialog({ open: false, message: "", isError: false })} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Close</button>
                  )}
                </div>
              </div>
            )}
            <ToastContainer position="top-right" autoClose={3000} />
          </>
        )}
      </div>
    </ProtectedLayout>
  );
} 