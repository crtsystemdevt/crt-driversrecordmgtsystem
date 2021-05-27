const { render } = require('ejs');
const express = require('express')
const crypto = require("crypto");

const app = express();

app.use((req, res, next) => req.session.loggedIn ? res.redirect('/hr/home') : next())

app.get('/login', (req, res) => {
    let loginMsg = '';
    res.render('home', { message: loginMsg });
})

app.post('/login', (req, res) => {
    let usernameID = req.body.usernameID;
    let password = req.body.password;
    let loginMsg = 'Incorrect Username/Password';

    if (usernameID && password) {
        gdb.query('SELECT * FROM users WHERE Username = ? AND Password = ?', [usernameID, password], function (error, results, fields) {
        if (results.length > 0) {
            req.session.loggedIn = true
            req.session.Username = results[0].Username;
            console.log(results[0].Username + ' has logged in')
            res.redirect('/hr/home');
        } else {
            res.render("home", { message: loginMsg});
        }
        res.end();
        });
    } else {
        res.redirect('/home');
    }
})

module.exports = app;