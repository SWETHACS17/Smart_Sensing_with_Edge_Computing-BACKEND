# Smart Sensing with Edge Computing — Backend

Backend handles collecting sensor data from the STM32F401 board via UART and stores it in MongoDB. It also provides API endpoints for the frontend to get this data.


## How It Works in Simple Terms

- The BME280 sensor collects temperature, humidity, and pressure.
- STM32F401 reads this data and sends it over a serial connection (UART).
- The Node.js backend reads this serial data, saves it in a MongoDB database.
- The frontend asks the backend for this saved data to display.


## Tools and Libraries Used

- Node.js with Express.js for the server
- MongoDB and Mongoose for the database
- serialport package to talk to the STM32 board
- dotenv for managing settings
- CORS enabled so frontend can access APIs


## Getting Started

1. Install Node.js (v18 or newer) and MongoDB.

2. Connect your STM32 board to your computer.

3. Open terminal and go to backend folder:
```bash
cd backend
```
4. Install dependencies:
```bash
npm install
```
5. Create a file `.env` in the backend folder with these settings:
    - PORT=5000
    - MONGODB_URI=mongodb://localhost:27017/smart-sensing-db
    - SERIAL_PORT=COM3
    - SERIAL_BAUDRATE=9600
    - NODE_ENV=development
  
Make sure `SERIAL_PORT` matches your computer’s port that STM32 connects to.

6. Start the backend server:
```bash
npm start
```
Backend will be available at [http://localhost:5000](http://localhost:5000).


## Available API Endpoints

- `GET /api/sensor/latest` — Returns the latest sensor reading.
- `GET /api/sensor/all` — Returns all saved readings.
- `POST /api/sensor` — Manually add data (useful for testing).


## Example of Incoming Serial Data

The STM32 sends sensor data in this format:

T:24.7,H:56.2,P:1003.4

The backend reads this string, extracts temperature, humidity, and pressure, and saves them to the database with a timestamp.


## MongoDB Data Format Example

{
temperature: 24.7,
humidity: 56.2,
pressure: 1003.4,
timestamp: "2025-10-14T08:00:00Z"
}


## Troubleshooting Tips

- Can’t find serial port? Double-check `SERIAL_PORT` in `.env` and ensure board is connected.
- MongoDB connection issues? Make sure MongoDB is running and your URI is correct.
- Data not saving? Look at backend logs for errors in the serial data.
- CORS errors? Enable CORS in your Express server or check frontend URL settings.



## Testing Without STM32

If you don’t have the STM32 connected, you can use a fake data generator script:

node utils/mockSerial.js

This will send fake sensor data to your backend for testing.





