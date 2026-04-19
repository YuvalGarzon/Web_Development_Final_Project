require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/db");


const PORT = process.env.PORT || 4000;


connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Auth server is up and running!`);
            console.log(`🔗 URL: http://localhost:${PORT}`);
            console.log(`📡 Ready for Stitch integration (CORS enabled)`);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    });