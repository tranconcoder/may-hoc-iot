import mongoose from 'mongoose';
import 'dotenv/config';

export default function connectDb() {
	return mongoose.connect(
		`mongodb+srv://tranvanconkg:5oiZhfSqzPG671Td@cluster0.i74lv.mongodb.net/`
	);
}
