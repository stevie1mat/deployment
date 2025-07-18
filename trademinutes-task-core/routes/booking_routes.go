package routes

import (
	"trademinutes-task-core/controllers"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/mongo"
)

func BookingRoutes(router *mux.Router, db *mongo.Database, jwtSecret string) {
	bookingRouter := router.PathPrefix("/api/bookings").Subrouter()
	bookingRouter.HandleFunc("/book", controllers.CreateBookingHandler()).Methods("POST")
	bookingRouter.HandleFunc("", controllers.GetBookingsHandler).Methods("GET")
}
