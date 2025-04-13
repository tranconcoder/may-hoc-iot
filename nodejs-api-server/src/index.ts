import { ApiController } from './controllers/api.controller';
import express from 'express';
import dotenv from 'dotenv';
import { Router } from 'express';
import mongoose from 'mongoose';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8386;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Connect mongodb
mongoose.connect(
	`mongodb+srv://tranvanconkg:JAZpjGcNQlksfeuQ@cluster0.i74lv.mongodb.net/`
);

// Create a router for the API
const apiRouter = Router();

apiRouter.post('/generate', ApiController.createOrUpdateRoom as any);

app.use('/api', apiRouter);

// Start the server
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
