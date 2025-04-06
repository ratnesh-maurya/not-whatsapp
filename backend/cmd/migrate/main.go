package main

import (
	"database/sql"
	"flag"
	"log"
	"os"

	"github.com/RatneshMaurya/not-whatsapp/backend/migrations"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	// Parse command line flags
	rollback := flag.Bool("rollback", false, "Rollback the last migration")
	flag.Parse()

	// Initialize database connection
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Test the connection
	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	// Run migrations
	if *rollback {
		log.Println("Rolling back last migration...")
		if err := migrations.RollbackMigrations(db); err != nil {
			log.Fatal(err)
		}
		log.Println("Successfully rolled back last migration")
	} else {
		log.Println("Running migrations...")
		if err := migrations.RunMigrations(db); err != nil {
			log.Fatal(err)
		}
		log.Println("Successfully ran all migrations")
	}
}
