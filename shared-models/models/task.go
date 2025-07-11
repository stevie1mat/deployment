package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type AvailabilitySlot struct {
	Date     string `bson:"date"`     // e.g., "2025-06-15"
	TimeFrom string `bson:"timeFrom"` // e.g., "14:00"
	TimeTo   string `bson:"timeTo"`   // e.g., "16:00"
}

type Author struct {
	ID     string `bson:"id"`     // e.g., "u456"
	Name   string `bson:"name"`   // e.g., "John Doe"
	Email  string `bson:"email"`  // e.g., "john.doe@example.com"
	Avatar string `bson:"avatar"` // e.g., "https://..."
}

type Task struct {
	ID           primitive.ObjectID `bson:"_id,omitempty"`         // MongoDB document ID
	Title        string             `bson:"title"`                 // e.g., "Need help with math homework"
	Description  string             `bson:"description,omitempty"` // e.g., "Looking for someone to help solve algebra problems"
	Location     string             `bson:"location"`              // e.g., "Downtown Library" or "Zoom"
	Latitude     float64            `bson:"latitude,omitempty"`    // e.g., 37.7749
	Longitude    float64            `bson:"longitude,omitempty"`   // e.g., -122.4194
	LocationType string             `bson:"locationType"`          // e.g., "online" or "in-person"
	Credits      int                `bson:"credits"`               // e.g., 10 (points or tokens)
	Author       Author             `bson:"author"`                // User who created the task
	Availability []AvailabilitySlot `bson:"availability"`          // e.g., [{ "date": "2025-06-15", "timeFrom": "14:00", "timeTo": "16:00" }]
	CreatedAt    int64              `bson:"createdAt,omitempty"`   // e.g., 1739654400 (Unix timestamp)
	Status       string             `bson:"status"`                // e.g., "open", "in progress", "completed"
	AcceptedBy   primitive.ObjectID `bson:"acceptedBy,omitempty"`  // MongoDB ID of helper
	CompletedAt  int64              `bson:"completedAt,omitempty"` // e.g., 1739740800 (Unix timestamp when completed)
	Type         string             `bson:"type"`                  // e.g., "offer" or "request"
	Category     string             `bson:"category"`              // e.g., "food", "education", "errand"
	IsBookable   bool               `bson:"isBookable"`            // true = can be booked, false = already booked or disabled
	Images       []string           `bson:"images,omitempty" json:"images,omitempty"`
}
