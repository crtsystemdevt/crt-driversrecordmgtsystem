const express = require('express');
const app = express();
const async = require("async")
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
var cookieParser = require('cookie-parser')
const LocalStrategy = require('passport-local').Strategy
const nodemailer = require('nodemailer');
const sendinBlue = require('nodemailer-sendinblue-transport');

const dotenv = require('dotenv').config()
const crypto = require("crypto");
var assert = require('assert');


const initializePassport = require('../passport-config')
initializePassport(passport)

app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized: true
}))

app.use(passport.initialize())
app.use(passport.session())
passport.serializeUser(function(user, done) {
    done(null, user);
});
  
passport.deserializeUser(function(user, done) {
    done(null, user);
});

app.use(cookieParser());
app.use(methodOverride('_method'))

app.use(function(req,res,next){
    res.locals.errors = req.flash("error");
    res.locals.infos = req.flash("info");
    res.locals.successes = req.flash("success");
    next();
})

//ADMIN PARTS
exports.admin_home = function(req, res){

    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="Admin"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an Admin site due to being an HR user of the system")
                    res.redirect('/hr/home')
                }else{
                    var obj = result[0]
                    message = "Welcome to the homepage!";
                    gdb.query('SELECT * FROM employee WHERE account_type="HR"', (err, result) => {
                        if(err){
                            console.log(err)
                        }else{
                            let account_type = ""
                            if(result.length == 0){
                                account_type = "";
                            } else{
                                remove2 = result[0].account_type.replace(/"/g,'').replace('[', '').replace(']', '');
                                splitds = remove2.split(',', '10')
                                account_type=splitds.map(i=>Number(i))
                            }            
                            res.render('admin_home', {message: message, data: result, account_type: account_type, Name:obj.username});
                        }
                    })
                }
            }
        })
    })
}

exports.account_recovery = function(req, res){
    let message ="";
    res.render('account-recovery',{message: message});
}

exports.account_reset_existing_request = function(req,res){
    res.render('account_reset_existing_request')
}

//SMTP SERVICE PROVIDER
  let transport = nodemailer.createTransport(sendinBlue({
      apiKey:'8YGAUORP6xcjw4Fv'
  }))

//POST RESET PASSWORD 
exports.reset_request = function (req,res, done){
    if(req.method == "POST"){
        let post = req.body;
        let  emp_email = post.email;
        
        gdb.connect(function(err){
            if(err){console.log(err)}
            gdb.query("SELECT * FROM employee WHERE emp_email=?", [emp_email], function(err,result1){
                //checking if existing user through email
                if(result1[0] == null){
                    //display to login page that user does not exist
                    console.log("user does not exist")
                    let message = "Email is not associated with any user of the system. Please try again."
                    return res.render('account-recovery',{message: message})
                }
                //console.log("The user who sent request is " + result1[0].username)

                //CHECK IF ALREAYD SUBMITTED REQUEST FOR THE LAST 15 MINUTES
                gdb.query("SELECT * FROM reset WHERE email=?",[emp_email], function(err,result3){
                    if(err){console.log(err)}
                    if(result3[0] == null){
                        
                //IF EXISTING USER, CREATE A RESET PASSWORD ID WHICH WILL BE USED FOR GETTING THEIR RESPECTIVE RESET PASSWORD PAGE
                gdb.query("SELECT * FROM reset ORDER BY id DESC", (err,result2) => {
                    //CREATE ID.. SAME WITH USERID APPID ALGO...
                    let resetID = Math.floor(Math.random() * 1000000000);
                    for(i=0; i<=result2.length; i++){
                        if(result2.length == 0){
                            resetID = Math.floor(Math.random() * 1000000000);
                        }else if(result2[0].id == resetID){
                            resetID = Math.floor(Math.random() * 1000000000);
                            continue;
                        }else{
                            //retain id
                        }   
                    }
                    //console.log(parseInt(resetID));

                    //AFTER CREATING ID FOR REQUEST, SAVE TO DB
                    gdb.query("INSERT INTO reset (id,email,expiry) VALUES (?,?,TIMESTAMP(CURRENT_TIMESTAMP,'00:15:00'))", [resetID,emp_email], function(err){
                        if(err){console.log(err)}
                        //CREATE THE EMAIL TO BE SENT THRU SMTP
                        const message = {
                            from: 'crtsystemdevt@gmail.com', //the official email for the system
                            to: emp_email,
                            subject: 'Password Reset Request',
                            text: 'Greetings!\n\nThe system received a request to recover access to your account.\nPlease click the link to set a new password.\n\nlocalhost:6100/new-password/'+resetID + '\n\nThis link will expire in 15 minutes. After that, you will need to submit a new request in order to reset your password.\n\nThank you.',
                            html:' <h2> Greetings! </h2> ' 
                            + '<br/> '
                            + '<p> The system received a request to recover access to your account.</p>'
                            + '<p> Please click the link below to set your new password. </p>'
                            + '<br/>'
                            + '<p> <a href="https://crt-driversrecordmgtsystem.herokuapp.com/new-password/' +resetID + '"> https://crt-driversrecordmgtsystem.herokuapp.com/new-password/' + resetID +'</a> </p>'
                            + '<br/>'
                            + '<p> This link will expire in 15 minutes. After that, you will need to submit a new request in order to reset your password. </p>'
                            + '<p> Thank you. </p>'
                            };
                            
                        //SEND EMAIL
                        transport.sendMail(message, function (err, info) {
                        if(err) {console.log(err)}
                        else{console.log(info); }
                        res.redirect('/account-recovery-sent')
                        })
                    })
                })

                    }else{
                    let message = "You have already submitted a reset password request for the last 15 minutes. Please check your email."
                    return res.render('account-recovery',{message: message})
                    }
                })

            })
        })
    }
}

exports.driver_email = function(req,res){
    if(req.method == "POST"){
        let post = req.body;
        let  driver_email = post.email;
        
        gdb.connect(function(err){
            if(err){console.log(err)}
                //IF EXISTING USER, CREATE A RESET PASSWORD ID WHICH WILL BE USED FOR GETTING THEIR RESPECTIVE RESET PASSWORD PAGE
                gdb.query("SELECT * FROM driver_sent ORDER BY id DESC", (err,result2) => {
                    //CREATE ID.. SAME WITH USERID APPID ALGO...
                    let linkID = Math.floor(Math.random() * 1000000000);
                    for(i=0; i<=result2.length; i++){
                        if(result2.length == 0){
                            linkID = Math.floor(Math.random() * 1000000000);
                        }else if(result2[0].id == linkID){
                            linkID = Math.floor(Math.random() * 1000000000);
                            continue;
                        }else{
                            //retain id
                        }   
                    }
                    //console.log(parseInt(linkID));


                    //AFTER CREATING ID FOR REQUEST, SAVE TO DB
                    gdb.query("INSERT INTO driver_sent (id,email,valid_until) VALUES (?,?,CURRENT_TIMESTAMP+INTERVAL 1 MONTH)", [linkID,driver_email], function(err){
                        if(err){console.log(err)}
                        //CREATE THE EMAIL TO BE SENT THRU SMTP
                        const message = {
                            from: 'crtsystemdevt@gmail.com', //the official email for the system
                            to: driver_email,
                            subject: 'Driver Information Sheet',
                            text: 'Greetings!\n\nThe management would like you to input your driver credentials in the given link.\n\nlocalhost:4000/driver-information/'+linkID + '\n\nThis link will expire in 30 days.\n\nThank you.',
                            html:' <h2> Greetings! </h2> ' 
                            + '<br/> '
                            + '<p> The management would like you to enter your driver credentials in the given link. </p> '
                            + '<br/>'
                            + '<p> <a href="https://crt-onlinedriverapplication.herokuapp.com/driver-information/' +linkID + '"> https://crt-onlinedriverapplication.herokuapp.com/driver-information/' + linkID +'</a> </p>'
                            + '<br/>'
                            + '<p> This link will expire in 30 days. </p>'
                            + '<p> Thank you. </p>'
                            };
                            
                        //SEND EMAIL
                        transport.sendMail(message, function (err, info) {
                        if(err) {console.log(err)}
                        else{console.log(info); }
                        res.redirect('/hr/managedrivers')
                        })
                    })
                })
            })
        //})
    }
}

exports.account_recovery_sent = function(req, res){
    res.render('account-recovery-sent');
}

//GET VALIDATION RESET PASS UI
exports.reset_sucess = function(req,res){
    res.render('account_reset_success');
}

//EXPIRED LINK GET
exports.reset_expired = function(req,res){
    res.render('account_reset_expired');
}

//GET PASSWORD RESET UI --- CHECKS IF RESET REQUEST IS STILL VALID
exports.reset_password = function(req,res){
    let resetID = req.params.id;

    //console.log("the id requesting pw change: " + resetID)

    gdb.connect(function(err){
        if(err){console.log(err)}
        //CHECK IF EXISTING
        gdb.query("SELECT * FROM reset WHERE id=?",[resetID],function(err,result){
            if(err){console.log(err)}
            let obj = result[0]
            if(obj == null){
                console.log("The request id does not exist")
                return res.redirect('/*');
            }
            let id = obj.id;

            gdb.query("SELECT DATE_FORMAT(CURRENT_TIMESTAMP,'%Y-%m-%d-%H-%i-%s') AS time", function(err,current_time){
                //console.log(current_time[0].time)

                gdb.query("SELECT DATE_FORMAT(expiry,'%Y-%m-%d-%H-%i-%s') AS expiry FROM reset WHERE id=?", [id], function(err,expiration_time){
                   //console.log(expiration_time[0].expiry)
                   console.log()
                    if(current_time[0].time < expiration_time[0].expiry){
                       //console.log("not expired")
                       res.render('account_reset_password',{data:obj})
                   }else{
                       gdb.query("DELETE FROM reset WHERE id=?",[id], function(err){
                        if(err){console.log(err)}
                        //console.log("Expired Request. Deleted from DB")
                        res.redirect('/reset-expired');
                    })
                   }
                })
            })
        })
    })
}

//POST FORGET PASSWORD
exports.new_password = function (req,res){
    let resetID = req.params.id;
    let passwordDecipher = crypto.createHash("sha256").update(req.body.password).digest("hex");
    let password = passwordDecipher;  

    gdb.connect(function(err){
        if(err){console.log(err)}
        //CONFIRM EMAIL OF THE REQUEST ID
        gdb.query("SELECT * FROM reset WHERE id=?",[resetID],function(err,result){
            if(err){console.log(err)}
            let email = result[0].email;
            //console.log("the account requesting for password reset is from: " + email)

            //CROSS REFERENCE THIS TO EMPLOYEE TABLE AND UPDATE
            gdb.query("UPDATE employee SET password=? WHERE emp_email=?",[password,email], (err,result1) =>{
                if(err){console.log(err)}
                //ONCE UPDATE, DELETE THE REQUEST ID FROM THE RESET TABLE
                gdb.query("DELETE FROM reset WHERE id=?",[resetID], (err) =>{
                    if(err){console.log(err)}
                    console.log("Successfully deleted reset password id request")
                    res.redirect('/reset-success')
                })
            })
        })
    })
}

//view admin profile
exports.admin_profile = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="Admin"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an Admin site due to being an HR user of the system")
                    res.redirect('/hr/home')
                }else{
                    var obj = result[0]
                    res.render('admin_profile', {data: obj})
                }
            }
        })
    })
}

//post update admin profile
exports.update_admin = async (req, res) =>{
    if(req.method == "POST"){
        //PERSONAL DATA
        let post = req.body;
        let emp_fname = post.firstName;
        let emp_lname = post.lastName;
        let emp_personal_num = post.personalNumber;

        //Account Details
        let username = post.username;
        let emp_email = post.emailAddress;
        let account_type = "Admin";
        
        gdb.query("UPDATE employee SET account_type=?, emp_fname=?, emp_lname=?, emp_personal_num=?, username=?, emp_email=? WHERE user_ID=?", [account_type, emp_fname, emp_lname, emp_personal_num, username, emp_email, req.session.passport.user] ,(err, result) => {
            if(err) {
                //console.log("error on employee update")
                console.log(err)
            }else{
                console.log("User: " + emp_fname + " was updated with the ID " + req.session.passport.user);
                res.redirect('/admin/home');
            }
        });
    }
}

exports.update_password = async (req, res) =>{
    if(req.method == "POST"){
        //PERSONAL DATA
        let passwordDecipher = crypto.createHash("sha256").update(req.body.newpassword).digest("hex");
        let password = passwordDecipher;        
        gdb.query("UPDATE employee SET password=? WHERE user_ID=?", [password, req.session.passport.user] ,(err, result) => {
            if(err) {
                //console.log("error on employee update")
                console.log(err)
            }else{
                console.log("New Password was set for user: " + req.session.passport.user)
                res.redirect('/hr/home');
            }
        });
    }
}

//VIEW USER ACCOUNT
exports.account_view = function(req,res){
    let user_ID = req.params.id;
    
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="Admin"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            //console.log("this is the current user trying to access: " + req.session.passport.user);
            //console.log("this is the result inside admin home" +result)
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an Admin site due to being an HR user of the system")
                    res.redirect('/hr/home')
                }else{
                    var obj = result[0]
                    //res.render('admin_home', {name: obj.emp_fname});
                    gdb.query("SELECT * FROM employee", (err, result) =>{
                        if(err) console.log(err)
                        else{
                            gdb.query("SELECT * FROM employee WHERE user_ID=?", [user_ID], (err, data) => {
                                if (err) {
                                  console.log(err);
                                } else {
                                    if(data[0] == null){
                                        res.redirect('/admin/error')
                                    } else{
                                        let password = data[0].password;
                                        let passwordDecipher = crypto.createHash("sha256").update(password).digest("hex");
                                        //console.log(passwordDecipher)

                                        let usernames = [];
                                        for(i=0; i<result.length; i++){
                                            usernames.push(result[i].username);
                                        }
                                        res.render('admin_edit_acc', {data: data[0], usernames: usernames, user_name:obj.username, passwordDecipher: passwordDecipher});
                                    }
                                }
                            })
                        }
                    })
                }
            }
        })
    })
}

//UPDATE USERACCOUNT
exports.account_edit = async (req, res) =>{
    if(req.method == "POST"){
        //PERSONAL DATA
        let post = req.body;
        let emp_fname = post.firstName;
        let emp_lname = post.lastName;
        let emp_personal_num = post.personalNumber;

        //Account Details
        let username = post.username;
        let emp_email = post.emailAddress;
        let account_type = "HR";
        
        let appid = req.params.id;

        gdb.query("UPDATE employee SET account_type=?, emp_fname=?, emp_lname=?, emp_personal_num=?, username=?, emp_email=? WHERE user_ID=?", [account_type, emp_fname, emp_lname, emp_personal_num, username, emp_email, appid] ,(err, result) => {
            if(err) {
                //console.log("error on employee update")
                console.log(err)
            }else{
                console.log("User: " + emp_fname + " was updated with the ID " + appid);
                res.redirect('/admin/home');
            }
        });
    }
}

exports.update_user_password = async (req, res) =>{
    if(req.method == "POST"){
        let user_ID = req.params.id;
        let passwordDecipher = crypto.createHash("sha256").update(req.body.newpassword).digest("hex");
        let password = passwordDecipher;        
        gdb.query("UPDATE employee SET password=? WHERE user_ID=?", [password, user_ID] ,(err, result) => {
            if(err) {
                //console.log("error on employee update")
                console.log(err)
            }else{
                console.log("New Password was set for user: " + user_ID)
                res.redirect('/admin/home');
            }
        });
    }
}

exports.admin_new_user = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="Admin"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an Admin site due to being an HR user of the system")
                    res.redirect('/hr/home')
                }else{
                    var obj = result[0]
                    //res.render('admin_home', {name: obj.emp_fname});
                    gdb.query('SELECT * FROM employee', (err, result) => {
                        if (err) {
                            console.log(err);
                        } else {
                            let usernames = [];
                            for(i=0; i<result.length; i++){
                                usernames.push(result[i].username);
                            }
                            res.render('admin_add_user',  {data: result, usernames: usernames, user_name:obj.username})
                        }
                    });

                }
            }
        })
    })
    

}

//ADD NEW USER POST
exports.admin_new_user_post = async (req, res) => {
    if(req.method == "POST"){
        //PERSONAL DATA
        let post = req.body;
        let emp_fname = post.firstName;
        let emp_lname = post.lastName;
        let emp_personal_num = post.personalNumber;

        let rawPassword = post.password;
        let passwordCipher = crypto.createHash("sha256").update(rawPassword).digest("hex");
        let emp_email = post.emailAddress;
        let username = post.username;
        let password = passwordCipher;
        let account_type = "HR";

        gdb.query('SELECT * FROM employee ORDER BY user_ID DESC', (err, result) => {
            if (err) {
                console.log(err);
            } else {
                let appid = Math.floor(Math.random() * 1000000000);
                for(i=0; i<=result.length; i++){
                    if(result.length == 0){
                        appid = Math.floor(Math.random() * 1000000000);
                    }else if(result[0].user_ID == appid){
                        appid = Math.floor(Math.random() * 1000000000);
                        continue;
                    }else{
                        //retain random appid
                    }   
                }
                //console.log(parseInt(appid));
                //let sql = `INSERT INTO employee (user_ID, account_type, emp_fname, emp_mname, emp_lname, emp_nickname, emp_gender, emp_address, emp_birthdate, emp_personal_num, emp_comp_num, emp_email, emp_contact_per, emp_contact_per_num, emp_contact_per_relation, emp_blood, emp_fb, username, password) VALUES(`+appid+`,'`+account_type+`', '`+emp_fname+`', '`+emp_mname+`', '`+emp_lname+`', '`+emp_nickname+`', '`+emp_gender+`', '`+emp_address+`', `+emp_birthdate+`, '`+emp_personal_num+`', '`+emp_comp_num+`', '`+emp_email+`', '`+emp_contact_per+`', '`+emp_contact_per_num+`', '`+emp_contact_per_relation+`', '`+emp_blood+`', '`+emp_fb+`', '`+username+`', '`+password+`')`;

                gdb.query('INSERT INTO employee (user_ID, account_type, emp_fname, emp_lname, emp_personal_num, emp_email, username, password) VALUES(?,?,?,?,?,?,?,?)', [appid, account_type, emp_fname, emp_lname, emp_personal_num, emp_email, username, password], (err, result) => {
                    if(err) {
                        console.log(err)
                    }else{
                        console.log(appid)
                        res.redirect('/admin/home');
                    }
                });
            } 
        });
    }
}

//DELETE USER DETAILS POST
exports.admin_deleteaccount = function(req, res){
    let user_ID = req.params.id;
    gdb.query("DELETE FROM employee WHERE user_ID=? AND account_type='HR'", [user_ID], (err, result) =>{
        if(err) console.log(err)
        else{
            console.log("User " + user_ID +" deleted!");
            res.redirect("/admin/home");
        }
    })
}