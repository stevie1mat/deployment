package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type ProfileStats struct {
	Rating            float64 `bson:"rating"`            // e.g., 4.85
	ReviewsCount      int     `bson:"reviewsCount"`      // e.g., 27
	TimeSpentHelping  string  `bson:"timeSpentHelping"`  // e.g., "10h 15m"
	SessionsConducted int     `bson:"sessionsConducted"` // e.g., 12
}

type Achievement struct {
	Title       string `bson:"title"`       // e.g., "Top Helper of the Week"
	Description string `bson:"description"` // optional
	DateEarned  string `bson:"dateEarned"`  // optional, for tracking
}

type User struct {
	ID                primitive.ObjectID `bson:"_id,omitempty"`
	Name              string             `bson:"name"`
	Email             string             `bson:"email"`
	Password          string             `bson:"password,omitempty"`
	College           string             `bson:"college,omitempty"`
	Program           string             `bson:"program,omitempty"`
	YearOfStudy       string             `bson:"yearOfStudy,omitempty"` // Use string for "2nd Year B.Sc. CS"
	Bio               string             `bson:"bio,omitempty"`
	Gender            string             `bson:"gender,omitempty"` // e.g., "male", "female", "other"
	Skills            []string           `bson:"skills,omitempty"` // Tags like #Python, etc.
	ProfilePictureURL string             `bson:"profilePictureURL,omitempty"`
	Stats             ProfileStats       `bson:"stats,omitempty"`
	Achievements      []Achievement      `bson:"achievements,omitempty"`
	Location          string             `bson:"location,omitempty"`  // optional
	CreatedAt         int64              `bson:"createdAt,omitempty"` // Unix timestamp
}
