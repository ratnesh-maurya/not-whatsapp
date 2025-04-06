package migrations

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func RunMigrations(db *sql.DB) error {
	log.Println("Starting migrations...")

	// Get the absolute path to the migrations directory
	migrationsDir, err := filepath.Abs("migrations")
	if err != nil {
		return fmt.Errorf("error getting migrations directory path: %v", err)
	}
	log.Printf("Migrations directory: %s", migrationsDir)

	// Check if directory exists
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		return fmt.Errorf("migrations directory does not exist: %s", migrationsDir)
	}

	// Get all migration files
	files, err := ioutil.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("error reading migration directory: %v", err)
	}

	// Filter and sort migration files
	var migrations []string
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".up.sql") {
			migrations = append(migrations, filepath.Join(migrationsDir, file.Name()))
			log.Printf("Found migration file: %s", file.Name())
		}
	}
	sort.Strings(migrations)

	if len(migrations) == 0 {
		return fmt.Errorf("no migration files found in directory: %s", migrationsDir)
	}

	// Create migrations table if it doesn't exist
	log.Println("Creating schema_migrations table if not exists...")
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("error creating migrations table: %v", err)
	}

	// Run each migration
	for _, migration := range migrations {
		version := filepath.Base(strings.TrimSuffix(migration, ".up.sql"))

		// Check if migration has already been applied
		var count int
		err = db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = $1", version).Scan(&count)
		if err != nil {
			return fmt.Errorf("error checking migration status: %v", err)
		}
		if count > 0 {
			log.Printf("Migration %s already applied, skipping", version)
			continue
		}

		// Read migration file
		log.Printf("Reading migration file: %s", migration)
		content, err := ioutil.ReadFile(migration)
		if err != nil {
			return fmt.Errorf("error reading migration file %s: %v", migration, err)
		}

		// Start transaction
		log.Printf("Starting transaction for migration %s", version)
		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("error starting transaction: %v", err)
		}

		// Execute migration
		log.Printf("Executing migration %s", version)
		_, err = tx.Exec(string(content))
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("error executing migration %s: %v", migration, err)
		}

		// Record migration
		log.Printf("Recording migration %s", version)
		_, err = tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", version)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("error recording migration %s: %v", migration, err)
		}

		// Commit transaction
		log.Printf("Committing migration %s", version)
		err = tx.Commit()
		if err != nil {
			return fmt.Errorf("error committing migration %s: %v", migration, err)
		}

		log.Printf("Successfully applied migration %s", version)
	}

	log.Println("All migrations completed successfully")
	return nil
}

func RollbackMigrations(db *sql.DB) error {
	log.Println("Starting rollback...")

	// Get the last applied migration
	var lastMigration string
	err := db.QueryRow("SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1").Scan(&lastMigration)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("No migrations to rollback")
			return nil
		}
		return fmt.Errorf("error getting last migration: %v", err)
	}

	log.Printf("Rolling back migration %s", lastMigration)

	// Get the absolute path to the migrations directory
	migrationsDir, err := filepath.Abs("migrations")
	if err != nil {
		return fmt.Errorf("error getting migrations directory path: %v", err)
	}

	// Read and execute down migration
	downFile := filepath.Join(migrationsDir, lastMigration+".down.sql")
	log.Printf("Reading down migration file: %s", downFile)
	content, err := ioutil.ReadFile(downFile)
	if err != nil {
		return fmt.Errorf("error reading down migration file %s: %v", downFile, err)
	}

	// Start transaction
	log.Println("Starting rollback transaction")
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("error starting transaction: %v", err)
	}

	// Execute down migration
	log.Println("Executing down migration")
	_, err = tx.Exec(string(content))
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("error executing down migration %s: %v", downFile, err)
	}

	// Remove migration record
	log.Println("Removing migration record")
	_, err = tx.Exec("DELETE FROM schema_migrations WHERE version = $1", lastMigration)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("error removing migration record %s: %v", lastMigration, err)
	}

	// Commit transaction
	log.Println("Committing rollback")
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("error committing down migration %s: %v", downFile, err)
	}

	log.Printf("Successfully rolled back migration %s", lastMigration)
	return nil
}
