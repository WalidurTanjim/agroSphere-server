require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const port = process.env.PORT || 5000;



// middlewares
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2yrio.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
});

// AI Model Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // database info
    const db = client.db('agroSphere');
    const usersCollection = db.collection('users');
    const videosCollection = db.collection('videos');


    // users
    app.get('/users', async(req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    })

    app.post('/users', async(req, res) => {
        const newUser = req.body;
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
    })

    //videos
    app.get('/videos', async (req, res) => {
      const videos = await videosCollection.find().toArray();
      res.send(videos);
    });

    app.post('/videos', async (req, res) => {
      const newVideo = req.body;
      const result = await videosCollection.insertOne(newVideo);
      res.send(result);
    });


    // AI integrate (saikat ahmed)
    app.post('/ai-response', async (req, res) => {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Please provide a valid prompt." });
      }

      try {
        const response = await model.generateContent(prompt);
        const text = response.response.text();
        res.json({ answer: text });
      } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ message: "AI processing failed. Please try again later." });
      }
    });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('AgroSphere server is running');
})

app.listen(port, () => {
    console.log("Humm, AgroSphere server is running...")
})