//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose =  require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {}
  }));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: [String]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());

// // only for passport-local-mongoose, local way
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

// for all of serializedUser and deserializedUser
passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.listen(3000, function(){
    console.log("Successfully connect to port 3000");
});

app.get("/",function(req,res){
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate('google', { scope: ['email','profile'] }));

app.get("/auth/google/secrets", 
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect to secret page.
      res.redirect('/secrets');
    });

app.get('/auth/facebook',
    passport.authenticate('facebook'));
  
app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect to secret page.
      res.redirect('/secrets');
    });

app.route("/login")
    .get(function(req,res){
        res.render("login");
    })
    .post(function(req,res){
        const user =  new User({
            username: req.body.username,
            password: req.body.password
        });

        req.logIn(user, function(err){
            if (err) {console.log(err)}
            else {
                passport.authenticate("local")(req, res, function(){
                    res.redirect("/secrets");
                });
            }
        });
    });

app.route("/register")
    .get(function(req,res){
        res.render("register");
    })
    .post(function(req,res){
        User.register({username: req.body.username}, req.body.password, function(err, user) {
            if (err) {
                console.log(err);
                res.redirect("/register");
            } else {
                passport.authenticate("local")(req, res, function(){
                    res.redirect("/secrets");
                });
            }
        });
    });

app.route("/secrets")
    .get(function(req,res){
        User.find({'secret':{$ne: null}}, function(err, usersWithSecret){
            if (err) { console.log(err) }
            else {
                res.render("secrets", {usersWithSecret: usersWithSecret});
            }
        });
    });

app.route("/logout")
    .get(function(req,res){
        req.logout();
        res.redirect("/");
    });

app.route("/submit")
    .get(function(req,res){
        if (req.isAuthenticated()) {
            res.render("submit")
        } else {
            res.render("login");
        }
    })
    .post(function(req,res){
        const userSecret = req.body.secret;
        User.findById(req.user.id, function(err,user){
            if (err) { console.log(err) }
            else {
                user.secret.push(userSecret);
                user.save(function(err){
                    res.redirect("/secrets");
                });
            }
        });
    });