const LocalStrategy = require('passport-local').Strategy
const crypto = require("crypto");
var assert = require('assert');

module.exports = function (passport){
    passport.serializeUser((user,done) => { 
        done(null, user.user_ID)
    })

    passport.deserializeUser(function(user_ID,done){  
        gdb.connect();
        gdb.query("SELECT * FROM employee WHERE user_ID = ?", [user_ID], function(err,row){
            done(err,row);
        });
     });
  
    passport.use('local-login', new LocalStrategy({
        usernameField: 'usernameID',
        passwordField: 'password',
        passReqToCallback:true
    },
    
    function(req,username,password,done){
        gdb.connect();
        gdb.query("SELECT * FROM employee WHERE username = ?", [username], async function(err,res){
            if(err){
                return done(err)
            }
            if(!res.length){
                console.log("username does not exist")
                return done(null,false, req.flash('loginMessage',"Username Doesn't Exist"))
            }
            let passwordDecipher = crypto.createHash("sha256").update(password).digest("hex");
            try{
                if(await passwordDecipher == res[0].password){
                    return done(null, res[0])
                }else{
                    console.log("login fail.. this is inside passport-config")
                    return done(null, false, req.flash('loginMessage',"Incorrect Password"))
                }
            }catch(err){
                return done(err)
            }
        })
    }))
} 
