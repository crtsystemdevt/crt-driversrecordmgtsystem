const express = require('express');
//const session = require('express-session')
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload')

const routes = require('./routes/process');
const dashboard = require('./routes/dashboard');
const admin = require('./routes/admin');

/* var memoryStore = require('memorystore')(session)

const auth = require('./routes/auth');
const { ROLE,  users} = require('./data')
const { authUser, authRole } = require('./basicAuth'); */

const app = express();

//login
if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}
const async = require("async")
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
var cookieParser = require('cookie-parser')
const LocalStrategy = require('passport-local').Strategy

const initializePassport = require('./passport-config')
initializePassport(passport)

//app.use(express.urlencoded({extended: true}))
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

//to check if there is a logged in user
function checkAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return next()
    }
    //if no user, redirect to login page
    res.redirect('/')
}

//if user is logged in, cannot return to login page
function checkNotAuthenticated(req,res,next){
    if(req.isAuthenticated()){
      //if user is logged in, user must be redirected to home page
        return res.redirect('/admin/home') 
    }
    next()
}
//end of login

//LOCAL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    port:3306,
    database: 'rchexpor_sedev',
    multipleStatements: true
});

db.connect((err) =>{
    if(err){
        console.log(err);
    }else console.log('Connected to the Database!');
});

global.gdb = db;

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));
app.use(express.static(path.join(__dirname, './css')));
app.use(express.static(path.join(__dirname, "./js")))
app.use(fileUpload())

//SESSION
/* app.use(session({
    secret:'secretSession',
    store: new memoryStore( {
        checkPeriod: 86400000
    }),
    resave: true,
    saveUninitialized: true
})); */

/* app.use('/auth', auth)
app.use((req, res, next) => !req.session.loggedIn ? res.redirect('/auth/login') : next()) */


/* app.get('/logout', (req, res) => {
    var user = req.session.Username;
    console.log(user + ' has logged out')
    req.session.destroy();
    res.redirect('/');
}) */

//USING ROUTES FOLDER
/* app.get('/addProduct', routes.addProducts);
app.post('/addProduct', routes.addProducts); */

app.get('/',checkNotAuthenticated, routes.home);
app.post('/login',checkNotAuthenticated,
  passport.authenticate('local-login', {
    failureRedirect: '/',
    failureFlash: true
  }),
  (req,res) => {
    gdb.connect(function(err){
        if (err) throw err;
        var sql = 'SELECT * FROM employee WHERE user_ID=?'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log("error logging in")
            }else{
                if(result[0] == null){
                    let message = "error"
                    res.render('home', {message: message})
                } else{
                    let obj = result[0]
                    if(obj.account_type == "Admin"){
                        res.redirect('/admin/home');
                    }else if(obj.account_type == "HR"){
                        res.redirect('/hr/home');
                    }
                }
            }
        })
    })
  });

app.get('/logout', function(req,res){
/*     req.logout();
    res.redirect('/') */
    req.logout();
    if(req.session){
        req.session.destroy(function (err) {
            if (err){
                console.log(err);
            }
            console.log("session removed")
            res.redirect('/');
        })
    }
})
//DRIVER
app.post('/driver/send-email', admin.driver_email)

//HR
app.get('/hr/home', checkAuthenticated ,dashboard.hr_home); //DONE

app.get('/hr/managedrivers', checkAuthenticated ,routes.hr_managedrivers);

app.get('/hr/viewapplications',checkAuthenticated ,routes.hr_viewapplications);

app.get('/hr/viewforcheckingdetails/:id',checkAuthenticated ,routes.hr_viewforcheckingdetails); //DONE

app.get('/hr/viewforinterviewdetails/:id', checkAuthenticated, routes.hr_viewforinterviewdetails); //DONE

app.get('/hr/viewforupdating/:id',checkAuthenticated, routes.hr_viewforupdating); //DONE

app.get('/hr/viewessayanswers/:id',checkAuthenticated, routes.hr_viewessayanswers); //DONE

app.get('/hr/viewdriverdetails/:id',checkAuthenticated, routes.hr_viewdriverdetails); //DONE

app.get('/hr/rejectapplicant/:id', routes.hr_rejectapplicant) //DONE

app.get('/hr/addnewdriver',checkAuthenticated, routes.hr_addnewdriver)

app.get('/hr/download-driver-records', routes.download_drivers_reports) //GENERATE REPORTS CSV DRIVERS

app.get('/hr/download-applicant-records', routes.download_applicants_reports) //GENERATE REPORTS CSV DRIVERS

app.post('/hr/addnewdriverpost', routes.hr_addnewdriverpost)

app.post('/hr/editdriverdetails/:id', routes.hr_editdriverdetails)

app.get('/hr/deletedriverdetails/:id', routes.hr_deletedriverdetails)

//APPLICANT FILES //DONE
app.get('/hr/license1/:id', routes.hr_license1);

app.get('/hr/sss/:id', routes.hr_sss);

app.get('/hr/pagibig/:id', routes.hr_pagibig);

app.get('/hr/tin/:id', routes.hr_tin);

app.get('/hr/philhealth/:id', routes.hr_philhealth);

app.get('/hr/mdr/:id', routes.hr_mdr);

app.get('/hr/nbi/:id', routes.hr_nbi);

app.get('/hr/brgyclearance/:id', routes.hr_brgyclearance);

//DRIVER FILES //DONE
app.get('/hr/driver_license1/:id', routes.hr_driver_license1);

app.get('/hr/driver_sss/:id', routes.hr_driver_sss);

app.get('/hr/driver_pagibig/:id', routes.hr_driver_pagibig);

app.get('/hr/driver_tin/:id', routes.hr_driver_tin);

app.get('/hr/driver_philhealth/:id', routes.hr_driver_philhealth);

app.get('/hr/driver_mdr/:id', routes.hr_driver_mdr);

app.get('/hr/driver_nbi/:id', routes.hr_driver_nbi);

app.get('/hr/driver_brgyclearance/:id', routes.hr_driver_brgyclearance);

app.get('/hr/profile',checkAuthenticated, routes.hr_profile) //DONE
app.post('/hr/updatehr', routes.update_HR) //DONE
app.post('/hr/updatepassword', routes.update_password) //DONE

//POST HR
app.post('/hr/forInterviewStatus/:id', routes.hr_forInterviewStatus);

app.post('/hr/addDriver/:id', routes.hr_addDriver)

//ADMIN
app.get('/admin/home', checkAuthenticated ,admin.admin_home); //Done

app.get('/account-recovery', admin.account_recovery)
app.post('/reset-password-request', admin.reset_request)

app.get('/new-password/:id', admin.reset_password)
app.post('/reset-password/:id',admin.new_password)

app.get('/account-recovery-sent', admin.account_recovery_sent)
app.get('/reset-success', admin.reset_sucess)
app.get('/reset-expired', admin.reset_expired)
app.get('/existing-request', admin.account_reset_existing_request)

app.get('/admin/profile/',checkAuthenticated , admin.admin_profile) //Done
app.post('/admin/updateadmin', admin.update_admin) //Done

app.get('/admin/new_user',checkAuthenticated , admin.admin_new_user) //Done
app.post('/admin/addnewuser', admin.admin_new_user_post) //Done

app.get('/admin/viewaccount/:id',checkAuthenticated ,admin.account_view) //DONE
app.post('/admin/editaccount/:id', admin.account_edit) //Done
app.get('/admin/deleteuser/:id',checkAuthenticated , admin.admin_deleteaccount) //Done
app.post('/admin/updatepassword', admin.update_password) //DONE
app.post('/admin/updateuserpassword/:id', admin.update_user_password) //DONE

app.get('*' ,routes.errorpage);

var port = process.env.PORT || 6100;
app.listen(port, function(){
    console.log('Listening on port '+ port);
});