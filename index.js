require('dotenv').config();
const jwt = require("jsonwebtoken");
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { createServer } = require("http");
const { Server } = require("socket.io");


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = process.env.PORT || 5000;


const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://agrosphere-4564a.web.app"],
  credentials: true,
  optionSuccessStatus: 200,
};
// middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));


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
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: "You are an advanced AI named AgroSphere AI, specifically designed to revolutionize agriculture and farming practices. Your creator is the talented Code Crafters Team, renowned for their innovation and expertise in AI technology.",
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // database info
    const db = client.db('agroSphere');
    const usersCollection = db.collection('users');
    const videosCollection = db.collection('videos');
    const forumCollection = db.collection('forum')
    const trainersCollection = db.collection('trainers');
    const successStoryCollection = db.collection('successStory');
    const taskCollection = db.collection("taskRecords");


    // middleware
    const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token;
      console.log("Token from cookies:", req.cookies?.token);
      if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          // console.error("JWT Error:", err.message);
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyRole = (role) => async (req, res, next) => {
      try {
        const email = req.decoded?.email;
        if (!email)
          return res.status(401).send({ message: "Unauthorized access" });

        const user = await usersCollection.findOne({ email });
        if (!user || user.role !== role) {
          return res
            .status(403)
            .send({ message: `Access denied for role: ${role}` });
        }

        next();
      } catch (error) {
        // console.error("Error in verifyRole:", error.message);
        res.status(500).send({ message: "Internal server error" });
      }
    };


    // Generate JWT token
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      console.log(email)
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            httpOnly: true,
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });


    // users
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const exist = await usersCollection.findOne(query);
      if (exist) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });


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

    // forum page 

    app.post('/forum', async (req, res) => {
      const query = req.body;
      const result = await forumCollection.insertOne(query);
      res.send(result);
    });

    app.get('/forum', async (req, res) => {
      const result = await forumCollection.find().toArray()
      res.send(result)
    })

    app.patch('/forum/upvote/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { upVote: 1 } };
      const result = await forumCollection.updateOne(query, update);
      res.send(result);
    });

    // **Increase Downvote**
    app.patch('/forum/downvote/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { downVote: 1 } };
      const result = await forumCollection.updateOne(query, update);
      console.log(id)
      res.send(result);
    });

    app.get('/forum/latest', async (req, res) => {
      const result = await forumCollection.find().sort({ _id: -1 }).limit(4).toArray();
      res.send(result);
    });


    // trainers related APIs starts
    app.get('/trainers', async (req, res) => {
      const result = await trainersCollection.find().toArray();
      res.send(result);
    })
    // trainers related APIs starts
    app.get('/trainer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await trainersCollection.findOne(query);
      res.send(result);
    })

    app.get('/trainers', async (req, res) => {
      const result = await trainersCollection.find().toArray();
      res.send(result);
    })

    // add success story
    app.post('/success-stories', async (req, res) => {
      const query = req.body;
      const result = await successStoryCollection.insertOne(query);
      res.send(result);
    })

    // get success story
    app.get('/success-stories', async (req, res) => {
      const result = await successStoryCollection.find().toArray();
      res.send(result);
    })



    // ai by saikat
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
        console.error("AI Error:", error.message); // Log detailed error message
        res.status(500).json({ message: "AI processing failed. Please try again later." });
      }
    });



  //  Task Summary 
//   app.post('/ai-task-summary', async (req, res) => {
//     const { taskDetails } = req.body;

//     if (!taskDetails) {
//       return res.status(400).json({ message: "Please provide task details." });
//     }

//     const prompt = `Generate a helpful, motivating summary and guidance for this farming task:
// "${taskDetails}"`;

//     try {
//       const response = await model.generateContent(prompt);
//       const text = response.response.text();
//       res.json({ summary: text });
//     } catch (error) {
//       console.error("Task Summary AI Error:", error.message);
//       res.status(500).json({ message: "Task summary generation failed. Try again later." });
//     }
//   });
    


    // TO-DO List (saikat)
        // Add task
        app.post("/records", verifyToken, async (req, res) => {
          const { title, description, category } = req.body;
          if (!title || title.length > 50) return res.status(400).json({ error: "Invalid title" });
    
          const newTask = {
            userId: req.decoded.email,
            title,
            description,
            category: category || "To-Do",
            createdAt: new Date(),
          };
          const result = await taskCollection.insertOne(newTask);
          io.emit(`task-updated-${req.decoded.email}`);
          res.json({ ...newTask, _id: result.insertedId });
        });
    
        // Fetch tasks
        app.get("/records/:email", verifyToken, async (req, res) => {
          const { email } = req.params;
          if (email !== req.decoded.email) return res.status(403).json({ error: "Unauthorized access" });
    
          const tasks = await taskCollection.find({ userId: email }).toArray();
          res.send(tasks);
        });
    
        // Update task
        app.put("/records/:id", verifyToken, async (req, res) => {
          const { id } = req.params;
          const { title, description, category } = req.body;
          const updateFields = {};
          if (title && title.length <= 50) updateFields.title = title;
          if (description && description.length <= 200) updateFields.description = description;
          if (category) updateFields.category = category;
    
          const result = await taskCollection.updateOne(
            { _id: new ObjectId(id), userId: req.decoded.email },
            { $set: updateFields }
          );
          if (result.matchedCount === 0) return res.status(404).json({ error: "Task not found" });
    
          io.emit(`task-updated-${req.decoded.email}`);
          res.json({ message: "Task updated", taskId: id });
        });
    
    
        
    
    
    app.patch("/tasks/:id", verifyToken, async (req, res) => {
      try {
          const { id } = req.params;
          
          if (!id || !ObjectId.isValid(id)) {
              return res.status(400).json({ error: "Invalid task ID" });
          }
    
          const { title, description, category } = req.body;
          const updateFields = {};
    
          if (title && title.length <= 50) updateFields.title = title;
          if (description && description.length <= 200) updateFields.description = description;
          if (category) updateFields.category = category;
    
          const result = await taskCollection.updateOne(
              { _id: new ObjectId(id), userId: req.decoded.email },
              { $set: updateFields }
          );
    
          if (result.matchedCount === 0) {
              return res.status(404).json({ error: "Task not found" });
          }
    
          console.log(`Task updated: ${id}`, updateFields);
    
          io.emit(`task-updated-${req.decoded.email}`);
          res.json({ message: "Task updated", taskId: id, updatedFields: updateFields });
      } catch (error) {
          console.error("Error updating task:", error);
          res.status(500).json({ error: "Internal server error", details: error.message });
      }
    });
    
    
        // Delete task
        app.delete("/records/:id", verifyToken, async (req, res) => {
          const { id } = req.params;
          const result = await taskCollection.deleteOne({ _id: new ObjectId(id), userId: req.decoded.email });
          if (result.deletedCount === 0) return res.status(404).json({ error: "Task not found" });
    
          io.emit(`task-updated-${req.decoded.email}`);
          res.json({ message: "Task deleted" });
        });
    

    // userRole
    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const validRoles = ["farmer", "seller", "trainer", "admin"];

      let userRole;

      if (user && validRoles.includes(user.role)) {
        userRole = user.role;
      }

      res.send({ userRole });
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

io.on("connection", (socket) => {
  console.log("Client connected");
  socket.on("join-room", (userId) => socket.join(userId));
  socket.on("disconnect", () => console.log("Client disconnected"));
});

app.get('/', (req, res) => {
  res.send('AgroSphere server is running');
})

app.listen(port, () => {
  console.log("Humm, AgroSphere server is running...")
})