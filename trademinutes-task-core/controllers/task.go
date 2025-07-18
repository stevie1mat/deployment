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
    "github.com/gorilla/mux"

	"trademinutes-task-core/utils"
)

var (
    taskCollection *mongo.Collection
    userCollection *mongo.Collection
)

// Call this from main.go to inject the DB collection
func SetTaskCollection(c *mongo.Collection) {
	taskCollection = c
}

func CategoriesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Categories)
}

// CreateTaskHandler handles creating a task
func CreateTaskHandler(db *mongo.Database, jwtSecret string) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Extract email from JWT
        email, err := utils.ExtractEmailFromJWT(r, jwtSecret)
        if err != nil {
            http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
            return
        }

        // Get user details
        user, err := utils.GetUserByEmail(db, email)
        if err != nil && err != mongo.ErrNoDocuments {
            http.Error(w, "Database error", http.StatusInternalServerError)
            return
        }

        // Decode task from request body
        var task models.Task
        if err := json.NewDecoder(r.Body).Decode(&task); err != nil {
            http.Error(w, "Invalid request body", http.StatusBadRequest)
            return
        }

        // Set author information
        task.Author = models.Author{
            ID:     user.ID.Hex(),     // Will be empty if not found
            Name:   user.Name,   // Will be empty if not found
            Email:  email,       // Always from JWT
            // Avatar: user.Avatar, // Will be empty if not found
        }
        task.CreatedAt = time.Now().Unix()
        task.IsBookable = true  // New tasks are bookable by default
        task.Status = "open"    // New tasks start as open

        // Insert into database
        result, err := taskCollection.InsertOne(context.TODO(), task)
        if err != nil {
            http.Error(w, "Failed to create task", http.StatusInternalServerError)
            return
        }

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusCreated)
        json.NewEncoder(w).Encode(result.InsertedID)
    }
}

// GetTaskHandler retrieves a task
func GetTaskByIdHandler(w http.ResponseWriter, r *http.Request) {
	idHex := mux.Vars(r)["id"]
	id, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var task models.Task
	err = taskCollection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&task)
	if err != nil {
		http.Error(w, "Task not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(task)
}

// Get all tasks
func GetAllTasksHandler(db *mongo.Database) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        cursor, err := db.Collection("tasks").Find(context.TODO(), bson.D{})
        if err != nil {
            http.Error(w, "Failed to fetch tasks", http.StatusInternalServerError)
            return
        }
        defer cursor.Close(context.TODO())

        var tasks []models.Task
        if err = cursor.All(context.TODO(), &tasks); err != nil {
            http.Error(w, "Failed to decode tasks", http.StatusInternalServerError)
            return
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(tasks)
    }
}

// UpdateTaskHandler updates a task
func UpdateTaskHandler(w http.ResponseWriter, r *http.Request) {
	idHex := mux.Vars(r)["id"]
	id, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var updates bson.M
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	_, err = taskCollection.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": updates})
	if err != nil {
		http.Error(w, "Update failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Task updated"}`))
}

// DeleteTaskHandler deletes a task
func DeleteTaskHandler(w http.ResponseWriter, r *http.Request) {
	idHex := mux.Vars(r)["id"]
	id, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	_, err = taskCollection.DeleteOne(context.Background(), bson.M{"_id": id})
	if err != nil {
		http.Error(w, "Delete failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Task deleted"}`))
}

// GetUserTasksHandler retrieves tasks for the logged-in user
func GetUserTasksHandler(db *mongo.Database, jwtSecret string) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Extract email from JWT
        email, err := utils.ExtractEmailFromJWT(r, jwtSecret)
        if err != nil {
            http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
            return
        }

        // Find tasks where the author email matches the logged-in user's email
        cursor, err := taskCollection.Find(context.TODO(), bson.M{"author.email": email})
        if err != nil {
            http.Error(w, "Failed to fetch user tasks", http.StatusInternalServerError)
            return
        }
        defer cursor.Close(context.TODO())

        var tasks []models.Task
        if err = cursor.All(context.TODO(), &tasks); err != nil {
            http.Error(w, "Failed to decode user tasks", http.StatusInternalServerError)
            return
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(tasks)
    }
}
