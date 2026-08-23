# Reminder that Reaches

# Instructions to getting started

## Install dependencies
At the root of the project, run the following command
```bash
# Installs backend dependencies
cd backend
npm install

# Installs frontend dependencies
cd ../frontend
npm install
```

## Initializing the database
At the root of the project, run the following command
```bash
# Create the data directory if it doesn't exist
mkdir data

cd backend
# Import the CSV files as tables in the database
npm run db:import
```