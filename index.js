require("dotenv").config();
const jwt = require("jsonwebtoken");
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require('bcrypt');
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://agrosphere-4564a.web.app",
  ],
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
  },
});

// AI Model Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // database info
    const db = client.db("agroSphere");
    const usersCollection = db.collection("users");
    const videosCollection = db.collection("videos");
    const forumCollection = db.collection("forum");
    const trainersCollection = db.collection("trainers");
    const successStoryCollection = db.collection("successStory");

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

    // app.use((req, res, next) => {
    //   res.setHeader("Access-Control-Allow-Origin", "*");
    //   next();
    // });

    const sendEmail = ({ recipient_email, OTP }) => {
      return new Promise((resolve, reject) => {
        var transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.MY_EMAIL,
            pass: process.env.MY_PASSWORD,
          },
        });

        const mail_configs = {
          from: process.env.MY_EMAIL,
          to: recipient_email,
          subject: "AGROSPHERE PASSWORD RECOVERY",
          html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Password Recovery - AgroSphere</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width:600px; margin:50px auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background-color:#1e9b76; padding:20px; text-align:center; color:white;">
      <h2 style="margin:0; font-size:24px;">AgroSphere</h2>
      <p style="margin:5px 0 0;">Secure Account Recovery</p>
    </div>

    <!-- Body -->
    <div style="padding:30px 40px;">
      <p style="font-size:16px; color:#333;">Hello,</p>
      <p style="font-size:16px; color:#333;">We received a request to reset your password. Use the following One-Time Password (OTP) to proceed. This OTP is valid for <strong>5 minutes</strong> only:</p>
      
      <div style="text-align:center; margin:30px 0;">
        <span style="display:inline-block; background-color:#1e9b76; color:white; font-size:22px; padding:12px 24px; border-radius:6px; letter-spacing:4px; font-weight:bold;">
          ${OTP}
        </span>
      </div>

      <p style="font-size:14px; color:#555;">If you didn’t request a password reset, you can ignore this email or contact support if you’re concerned.</p>

      <p style="margin-top:40px; font-size:14px; color:#333;">Thank you,<br>The AgroSphere Team</p>
    </div>

    <!-- Footer -->
    <div style="background:#f0f0f0; padding:20px; text-align:center; font-size:12px; color:#999;">
      <p style="margin:4px 0;">AgroSphere Inc.</p>
      <p style="margin:4px 0;">123 Green Valley Road, Farming District, Earth</p>
      <p style="margin:4px 0;">This is an automated message, please do not reply.</p>
    </div>

  </div>
</body>
</html>
`,
        };
        transporter.sendMail(mail_configs, function (error, info) {
          if (error) {
            console.log(error);
            return reject({ message: `An error has occured` });
          }
          return resolve({ message: "Email sent succesfuly" });
        });
      });
    };

    app.post("/send_recovery_email", (req, res) => {
      sendEmail(req.body)
        .then((response) => res.send(response.message))
        .catch((error) => res.status(500).send(error.message));
    });

    // Generate JWT token
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      console.log(email);
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
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

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

    // update user password
    app.put("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const { password } = req.body;
    
        if (!email || !password) {
          return res.status(400).send({ message: "Email or password missing." });
        }
    
        const query = { email };
        const user = await usersCollection.findOne(query);
    
        if (!user) {
          return res.status(404).send({ message: "User not found." });
        }
//     const hashedPassword = await bcrypt.hash(password, 10);
// const update = { $set: { password: hashedPassword } };
        const update = { $set: { password } };
        const result = await usersCollection.updateOne(query, update);
    
        if (result.modifiedCount === 0) {
          return res.status(500).send({ message: "Failed to update password." });
        }
    
        res.send({ message: "Password updated successfully." });
      } catch (err) {
        console.error("Error updating password:", err);
        res.status(500).send({ message: "Internal server error." });
      }
    });
    

    //videos
    app.get("/videos", async (req, res) => {
      const videos = await videosCollection.find().toArray();
      res.send(videos);
    });

    app.post("/videos", async (req, res) => {
      const newVideo = req.body;
      const result = await videosCollection.insertOne(newVideo);
      res.send(result);
    });

    // forum page

    app.post("/forum", async (req, res) => {
      const query = req.body;
      const result = await forumCollection.insertOne(query);
      res.send(result);
    });

    app.get("/forum", async (req, res) => {
      const result = await forumCollection.find().toArray();
      res.send(result);
    });

    app.patch("/forum/upvote/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { upVote: 1 } };
      const result = await forumCollection.updateOne(query, update);
      res.send(result);
    });

    // **Increase Downvote**
    app.patch("/forum/downvote/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { downVote: 1 } };
      const result = await forumCollection.updateOne(query, update);
      console.log(id);
      res.send(result);
    });

    app.get("/forum/latest", async (req, res) => {
      const result = await forumCollection
        .find()
        .sort({ _id: -1 })
        .limit(4)
        .toArray();
      res.send(result);
    });

    // trainers related APIs starts
    app.get("/trainer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await trainersCollection.findOne(query);
      res.send(result);
    });

    app.get("/trainers", async (req, res) => {
      const result = await trainersCollection.find().toArray();
      res.send(result);
    });

    // add success story
    app.post("/success-stories", async (req, res) => {
      const query = req.body;
      const result = await successStoryCollection.insertOne(query);
      res.send(result);
    });

    // get success story
    app.get("/success-stories", async (req, res) => {
      const result = await successStoryCollection.find().toArray();
      res.send(result);
    });

    // AI integrate (saikat ahmed)
    app.post("/ai-response", async (req, res) => {
      const { prompt } = req.body;

      if (!prompt) {
        return res
          .status(400)
          .json({ message: "Please provide a valid prompt." });
      }

      try {
        const response = await model.generateContent(prompt);
        const text = response.response.text();
        res.json({ answer: text });
      } catch (error) {
        console.error("AI Error:", error);
        res
          .status(500)
          .json({ message: "AI processing failed. Please try again later." });
      }
    });

    // userRole
    app.get("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const validRoles = ["farmer", "seller", "trainer", "admin"];

      let userRole;

      if (user && validRoles.includes(user.role)) {
        userRole = user.role;
      }

      res.send({ userRole });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("AgroSphere server is running");
});

app.listen(port, () => {
  console.log("Humm, AgroSphere server is running...");
});
