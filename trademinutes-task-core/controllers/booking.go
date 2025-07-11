package controllers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/ElioCloud/shared-models/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var bookingCollection *mongo.Collection

// SetBookingCollection injects the MongoDB collection
func SetBookingCollection(c *mongo.Collection) {
	bookingCollection = c
}

// Create a booking
func CreateBookingHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var booking models.Booking
		if err := json.NewDecoder(r.Body).Decode(&booking); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate required fields
		// taskId, bookerId, taskOwnerId, credits, and timeslots(date, timeFrom, timeTo) are received from the frontend
		if booking.TaskID.IsZero() || booking.BookerID.IsZero() || booking.TaskOwnerID.IsZero() || booking.Credits <= 0 || booking.Timeslot.Date == "" || booking.Timeslot.TimeFrom == "" || booking.Timeslot.TimeTo == "" {
			http.Error(w, "Missing required fields", http.StatusBadRequest)
			return
		}

		// Set server-side fields
		booking.ID = primitive.NewObjectID()
		booking.BookedAt = time.Now().Unix()
		if booking.Status == "" {
			booking.Status = "pending"
		}

		_, err := bookingCollection.InsertOne(context.TODO(), booking)
		if err != nil {
			http.Error(w, "Failed to save booking", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bookingId": booking.ID,
			"message":   "Booking created successfully",
		})
	}
}

// GetBookingsHandler returns all bookings for a specific user (owner or booker)
func GetBookingsHandler(w http.ResponseWriter, r *http.Request) {
	idHex := r.URL.Query().Get("id")
	role := r.URL.Query().Get("role") // "owner" or "booker"

	if idHex == "" || (role != "owner" && role != "booker") {
		http.Error(w, "Missing or invalid parameters", http.StatusBadRequest)
		return
	}

	userID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var filter bson.M
	if role == "owner" {
		filter = bson.M{"taskOwnerId": userID}
	} else {
		filter = bson.M{"bookerId": userID}
	}

	cursor, err := bookingCollection.Find(context.Background(), filter)
	if err != nil {
		http.Error(w, "Error fetching bookings", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.Background())

	var bookings []models.Booking
	if err = cursor.All(context.Background(), &bookings); err != nil {
		http.Error(w, "Error decoding bookings", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bookings)
}


