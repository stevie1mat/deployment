package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Booking struct {
    ID              primitive.ObjectID `bson:"_id,omitempty"`
    TaskID          primitive.ObjectID `bson:"taskId"`
    BookerID        primitive.ObjectID `bson:"bookerId"`        // User booking the task
    TaskOwnerID     primitive.ObjectID `bson:"taskOwnerId"`     // Task creator
    Timeslot        AvailabilitySlot   `bson:"timeslot"`        // Specific booked time
    Status          string             `bson:"status"`          // "pending", "confirmed", "completed", "cancelled"
    Credits         int                `bson:"credits"`         // Credits for this booking
    BookedAt        int64              `bson:"bookedAt"`        // When booking was made
    ConfirmedAt     int64              `bson:"confirmedAt,omitempty"`
    CompletedAt     int64              `bson:"completedAt,omitempty"`
    CancelledAt     int64              `bson:"cancelledAt,omitempty"`
    CancelledBy     string             `bson:"cancelledBy,omitempty"` // "booker" or "owner"
    Notes           string             `bson:"notes,omitempty"`       // Any additional notes
    Rating          int                `bson:"rating,omitempty"`      // 1-5 stars
    Review          string             `bson:"review,omitempty"`
}