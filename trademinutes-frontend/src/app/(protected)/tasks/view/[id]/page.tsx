"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ProtectedLayout from "@/components/Layout/ProtectedLayout";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Availability {
  date: string;
  timeFrom: string;
  timeTo: string;
}

interface Author {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  location: string;
  locationType: string;
  credits: number;
  availability: Availability[];
  author?: Author;
  createdAt?: number;
  completedAt?: number;
  status?: string;
  type?: string;
  acceptedBy?: string;
}

// Normalize raw API data with uppercase keys
function normalizeTask(raw: any): Task {
  return {
    id: raw.ID,
    title: raw.Title,
    description: raw.Description,
    location: raw.Location,
    locationType: raw.LocationType,
    credits: raw.Credits,
    availability: (raw.Availability || []).map((a: any) => ({
      date: a.Date,
      timeFrom: a.TimeFrom,
      timeTo: a.TimeTo,
    })),
    author: raw.Author
      ? {
          id: raw.Author.ID,
          name: raw.Author.Name,
          email: raw.Author.Email,
          avatar: raw.Author.Avatar,
        }
      : undefined,
    createdAt: raw.CreatedAt,
    completedAt: raw.CompletedAt,
    status: raw.Status,
    type: raw.Type,
    acceptedBy: raw.AcceptedBy,
  };
}

export default function ViewTaskPage() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_TASK_API_URL || "http://localhost:8084";
  const router = useRouter();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [messageModal, setMessageModal] = useState(false);
  const [firstMessage, setFirstMessage] = useState("");
  const [sendingFirstMessage, setSendingFirstMessage] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; message: string; isError?: boolean }>({ open: false, message: "", isError: false });

  useEffect(() => {
    const fetchTask = async () => {
      const token = localStorage.getItem("token");
      if (!token || !id) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/get/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();
        setTask(normalizeTask(json.data || json));
      } catch (err) {
        console.error("Error fetching task:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [id]);

  // Prevent double booking: check if user already booked this task
  useEffect(() => {
    const checkExistingBooking = async () => {
      const token = localStorage.getItem("token");
      if (!token || !id) return;
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
        console.error("Error fetching user profile for booking check:", error);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/bookings?role=booker&id=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const hasBooking = (json.data || json || []).some(
          (b: any) => (b.TaskID === id || b.taskId === id) && b.status !== "cancelled" && b.status !== "rejected"
        );
        setAlreadyBooked(hasBooking);
      } catch (err) {
        console.error("Error checking existing booking:", err);
      }
    };
    checkExistingBooking();
  }, [id]);

  if (loading || !task) {
    return (
      <ProtectedLayout headerName="Task Details">
        <div className="min-h-screen bg-white flex justify-center items-center">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-3xl border border-gray-200 flex items-center justify-center" style={{ minHeight: 320 }}>
            <span className="text-lg text-gray-600 font-medium">
              {loading ? "Loading task..." : "Task not found."}
            </span>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  function getCurrentUserEmail() {
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email;
    } catch {
      return null;
    }
  }

  const handleBooking = async () => {
    const token = localStorage.getItem("token");
    
    if (!token || !task) {
      alert("Missing data for booking.");
      return;
    }

    // Extract user email from JWT token and fetch user ID from profile
    let userEmail;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userEmail = payload.email;
    } catch (error) {
      console.error("Error decoding token:", error);
      alert("Error getting user information from token.");
      return;
    }

    if (!userEmail) {
      alert("User email not found in token.");
      return;
    }

    // Fetch user profile to get the user ID
    let loggedInUserID;
    try {
      const profileRes = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:8080'}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!profileRes.ok) {
        throw new Error("Failed to fetch user profile");
      }
      
      const profileData = await profileRes.json();
      loggedInUserID = profileData.ID || profileData.id;
      
      if (!loggedInUserID) {
        throw new Error("User ID not found in profile");
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      alert("Failed to get user information. Please try again.");
      return;
    }

    const requestBody = {
      taskId: task.id,
      bookerId: loggedInUserID,
      taskOwnerId: task.author?.id,
      credits: task.credits,
      timeslot: {
        date: task.availability?.[0]?.date,
        timeFrom: task.availability?.[0]?.timeFrom,
        timeTo: task.availability?.[0]?.timeTo,
      },
      status: "pending",
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Booking failed");
      }

      toast.success("Appointment booked successfully!");
      // router.push("/appointments");
    } catch (err: any) {
      console.error("Booking error:", requestBody);
      alert("Failed to book appointment: " + err.message);
    }
  };

  async function handleSendFirstMessage() {
    if (!task?.author?.email) {
      setDialog({ open: true, message: "No task owner email found.", isError: true });
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    const currentUserEmail = getCurrentUserEmail();
    if (!token || !currentUserEmail) {
      setDialog({
        open: true,
        message: `You must be logged in to message.\n\n[DEBUG]\ntoken: ${token}\ncurrentUserEmail: ${currentUserEmail}`,
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
          name: `Task: ${task.title}`,
          avatar: task.author.avatar,
          participants: [currentUserEmail, task.author.email].sort(),
          taskId: task.id
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
          senderName: (task.author && task.author.name) || "",
          senderAvatar: (task.author && task.author.avatar) || "",
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
        setMessageModal(false);
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
    <ProtectedLayout headerName="Task Details">
      <div className="min-h-screen bg-white flex justify-center items-start mt-20">
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-3xl border border-gray-200 relative mt-8">
          <button
            onClick={() => router.push('/tasks/explore')}
            className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full shadow border border-gray-200 text-sm font-medium transition mt-2 mb-10 ml-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Explore
          </button>
          <h1 className="text-3xl font-extrabold mb-2 text-emerald-700">{task.title}</h1>
          <p className="text-gray-700 mb-4 text-lg">{task.description}</p>
          <div className="grid gap-3 text-base text-gray-700 mb-6">
            <div>
              <span className="font-semibold">📍 Location:</span> {task.location} <span className="text-xs text-gray-500">({task.locationType})</span>
            </div>
            <div>
              <span className="font-semibold">🗓️ Availability:</span> {task.availability?.[0]?.date} from {task.availability?.[0]?.timeFrom} to {task.availability?.[0]?.timeTo}
            </div>
            <div>
              <span className="font-semibold">💰 Credits:</span> <span className="text-yellow-600 font-bold">{task.credits}</span>
            </div>
            {task.type && (
              <div>
                <span className="font-semibold">📦 Type:</span> {task.type}
              </div>
            )}
            {task.status && (
              <div>
                <span className="font-semibold">📌 Status:</span> {task.status}
              </div>
            )}
          </div>
          {task.author && (
            <div className="flex items-center gap-4 mb-6 p-4 bg-white/70 rounded-xl border border-gray-100">
              <Image
                src={task.author.avatar?.trim() ? task.author.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                width={56}
                height={56}
                className="rounded-full object-cover border border-gray-200"
                alt="avatar"
              />
              <div>
                <div className="font-semibold text-lg text-gray-800">{task.author.name}</div>
                <div className="text-gray-500 text-sm">{task.author.email}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={alreadyBooked}
            className={`inline-block text-center w-full bg-emerald-500 text-white py-3 rounded-xl text-lg font-semibold hover:bg-emerald-600 transition ${alreadyBooked ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {alreadyBooked ? "Already Booked" : <><span role="img" aria-label="calendar">📅</span> Book Appointment</>}
          </button>
          <button
            onClick={() => setMessageModal(true)}
            className="inline-block text-center w-full bg-blue-500 text-white py-3 rounded-xl text-lg font-semibold hover:bg-blue-600 transition mt-4 mb-2"
          >
            💬 Message Task Owner
          </button>
          {/* First Message Modal */}
          {messageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-xl shadow-lg p-8 min-w-[320px] text-center border border-blue-400">
                <div className="mb-2 text-lg font-semibold text-blue-600">Send a message to the task owner</div>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-2 mb-4 min-h-[80px]"
                  placeholder="Type your message..."
                  value={firstMessage}
                  onChange={e => setFirstMessage(e.target.value)}
                  disabled={sendingFirstMessage}
                />
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => { setMessageModal(false); setFirstMessage(""); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    disabled={sendingFirstMessage}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendFirstMessage}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    disabled={sendingFirstMessage}
                  >
                    {sendingFirstMessage ? "Sending..." : "Send & Start Chat"}
                  </button>
                </div>
              </div>
            </div>
          )}
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
          {showConfirmModal && (
            <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex justify-center items-center z-50">
              <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Confirm Booking
                </h2>
                <p className="text-gray-600 mb-2">
                  <strong>Date:</strong> {task.availability?.[0]?.date || "N/A"}
                </p>
                <p className="text-gray-600 mb-6">
                  <strong>Time:</strong> {task.availability?.[0]?.timeFrom || "-"} to {task.availability?.[0]?.timeTo || "-"}
                </p>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to book this appointment?
                </p>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      handleBooking();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                  >
                    Yes, Book It
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </ProtectedLayout>
  );
}
