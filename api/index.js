"use strict";

const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const { MongoClient } = require("mongodb");

let DATABASE_NAME = "cs193x_assign4";

/* Do not modify or remove this line. It allows us to change the database for grading */
if (process.env.DATABASE_NAME) DATABASE_NAME = process.env.DATABASE_NAME;

let api = express.Router();
let conn;
let db;
let Users, Posts;

module.exports = async (app) => {
  app.set("json spaces", 2);
  app.use("/api", api);

  //Connect to MongoDB
  conn = await MongoClient.connect("mongodb://localhost", {useUnifiedTopology: true});
  db = conn.db(DATABASE_NAME);
  Users = db.collection("users");
  Posts = db.collection("posts");
};

//Parse request bodies as JSON
api.use(bodyParser.json());
//Allow requests from any origin
api.use(cors());

api.get("/", (req, res) => {
  res.json({ message: "API running" });
});

/* list users */
api.get("/users", async (req, res) => {
  let users = await Users.find().toArray();
  res.json({ users: users.map(user => user.id) });
});

// Middleware to lookup Users
api.use("/users/:id", async (req, res, next) => {
  let id = req.params.id;
  let user = await Users.findOne( { id });
  if(!user){
    res.status(404).json({ error: "User doesn't exist"});
    return;
  }

  res.locals.user = user;
  next();
});

// Get a user's info
api.get("/users/:id", (req, res) => {
  let user = res.locals.user;
  let {id, name, avatarURL, following} = user;
  res.json({ id, name, avatarURL, following});
});

//Create a new user
api.post("/users", async (req, res) => {
  let allUsers = await Users.find().toArray();
  let id = req.body.id;
  if(allUsers.includes(id) || !(id)){
    res.status(400).json({ error: "Invalid ID to create new user"});
  }
  let name = id;
  let avatarURL = "";
  let following = [];
  await Users.insertOne({id, name, avatarURL, following});
  res.json({ id, name, avatarURL, following});
});

//Update a user's profile
api.patch("/users/:id", async (req, res) => {
  let user = res.locals.user;
  let id = req.body.id;
  let name = req.body.name;
  let avatarURL = req.body.avatarURL;
  await Users.replaceOne({ id: user.id}, user);
  res.json({ id: user.id, name, avatarURL});
});

//Get a user's feed
api.get("/users/:id/feed", async (req, res) => {
  console.log("trigger");
  let user = res.locals.user;
  let id = user.id;
  let following = user.following;
  let posts = await Posts.find({userId: id}).toArray();
  for(let i = 0; i < following.length; i++){
    let currId = following[i];
    let followPosts = await Posts.find({userId: currId}).toArray();
    for(let i = 0; i < followPosts.length; i++){
      posts.push(followPosts[i]);
    }
  }
  posts.sort();
  console.log("all");
  console.log(posts);
  res.json({ posts: posts});
});

//Have the user follow the target user
api.post("/users/:id/follow", async (req, res) => {
  let allUsers = await Users.find().toArray();
  let user = res.locals.user;
  let targetId = req.query.target; // read ID from query string
  if(user.id == targetId){
    res.status(400).json({ error: "Cannot follow yourself"});
    return;
  }
  if(!(allUsers.includes(targetId))){
    res.status(400).json({ error: "This user does not exist"});
    return;
  }
  let following = user.following;
  if(following.includes(targetId)){
    res.status(400).json({ error: "Invalid target to follow"});
    return;
  }
  following.push(targetId);
  user.following = following;
  await Users.replaceOne({ id: user.id }, user);
  console.log(user.following);
  res.json({ success: true });
});

//Create a new posts
api.post("/users/:id/posts", async (req, res) => {
  let text = req.body.text;
  if(!text){
    res.status(404).json({ error: "Text was not entered"});
  }
  let user = res.locals.user
  let userId = user.id;
  let time = new Date();
  await Posts.insertOne({userId, time, text});
  res.json({ success: true });
});

//Stop following target user
api.delete("/users/:id/follow", async (req, res) => {
  let user = res.locals.user;
  let targetId = req.query.target; // read ID from query string
  if(!targetId){
    res.status(400).json({ error: "Invalid target to unfollow"});
  }
  let following = user.following;
  if(!(following.includes(targetId))){
    res.status(400).json({ error: "User does not follow target"});
    return;
  }
  let index = following.indexOf(targetId);
  following.splice(index, 1);
  user.following = following;
  await Users.replaceOne({ id: user.id }, user);
  res.json({ success: true });
});

/* Catch-all route to return a JSON error if endpoint not defined */
api.all("/*", (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.url}` });
});
