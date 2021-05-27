const { ifError } = require("assert");
const { Console } = require("console");
const { render } = require("ejs");
const { join } = require("path");

const express = require('express');
const app = express();
const async = require("async")
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
var cookieParser = require('cookie-parser')
const LocalStrategy = require('passport-local').Strategy

const crypto = require("crypto");

const dotenv = require('dotenv').config()

const initializePassport = require('../passport-config')
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

exports.download_drivers_reports = function (req, res){
    const file = `./public/reports/CRT_Drivers.csv`;
    res.download(file); // Set disposition and send it.
}

exports.download_applicants_reports = function (req, res){
    const file = `./public/reports/CRT_Applicants.csv`;
    res.download(file); // Set disposition and send it.
}

//HOME PAGE GET / LOGIN PAGE
exports.home = function(req, res){
    res.render('home', {message: req.flash('loginMessage')});
}

exports.hr_profile = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    res.render('hr_profile', {data: obj})
                }
            }
        })
    })
}



//POST HR User Update
exports.update_HR = async (req, res) =>{
    if(req.method == "POST"){
        //PERSONAL DATA
        let post = req.body;
        let emp_fname = post.firstName;
        let emp_lname = post.lastName;
        let emp_personal_num = post.personalNumber;
        let account_type = "HR";
        
        gdb.query("UPDATE employee SET account_type=?, emp_fname=?, emp_lname=?, emp_personal_num=? WHERE user_ID=?", [account_type, emp_fname, emp_lname, emp_personal_num, req.session.passport.user] ,(err, result) => {
            if(err) {
                //console.log("error on employee update")
                console.log(err)
            }else{
                console.log("User: " + emp_fname + " was updated with the ID " + req.session.passport.user);
                res.redirect('/hr/home');
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

exports.hr_managedrivers = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    //res.render('admin_home', {name: obj.emp_fname});
                    message = "";
                    gdb.query(`SELECT *, DATE_FORMAT(date_joined, '%Y-%m-%d')AS date_joined FROM driver_personaldata`, (err, result) => {
                        //let driver_email = result[0].emailAddress;
                        if(err){
                            console.log(err)
                        }else{
                            let driver_status = ""
                            if(result.length == 0){
                                driver_status = "";
                            } else{
                                remove2 = result[0].driver_status.replace(/"/g,'').replace('[', '').replace(']', '');
                                splitds = remove2.split(',', '10')
                                driver_status=splitds.map(i=>Number(i))
                            }            
                            gdb.query("SELECT driver_personaldata.*, driver_licenses.licenseNumber1, driver_licenses.licenseExpiry1, driver_licenses.licenseType1, driver_licenses.licenseRestrictions1, driver_familybg.*, driver_workexperience.*, driver_educationalbg.* FROM driver_personaldata LEFT JOIN driver_licenses ON driver_personaldata.driverID = driver_licenses.license_ID LEFT JOIN driver_familybg ON driver_personaldata.driverID = driver_familybg.familybg_ID LEFT JOIN driver_workexperience ON driver_personaldata.driverID = driver_workexperience.workexperience_ID LEFT JOIN driver_educationalbg ON driver_personaldata.driverID = driver_educationalbg.educationalbg_ID", function (err, data, fields) {
                                if(err) console.log(err)
                                else{
                                    const fastcsv = require("fast-csv");
                                    const fs = require("fs");
                                    const ws = fs.createWriteStream("./public/reports/CRT_Drivers.csv", {flag: 'a'});
                                    const jsonData = JSON.parse(JSON.stringify(data));
                                    //console.log("jsonData", jsonData);
                        
                                    fastcsv.write(jsonData, {headers: true}).on("finish", function(){
                                        console.log("Generated Driver Records CSV");
                                    }).pipe(ws);

                                    gdb.query("SELECT email, DATE_FORMAT(valid_until,'%Y-%m-%d') AS Valid FROM driver_sent", function(err,result1){
                                        if(err){console.log(err)}
                                        let list = result1;
                                        //console.log(list)
                                        res.render('hr_managedrivers', {message: message, data: result, driver_status: driver_status, user_name:obj.username, list:list});
                                    })
                                }
                            })
                        }
                    })
                }
            }
        })
    })
}

exports.hr_viewapplications = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    gdb.query(`SELECT *, DATE_FORMAT(application_date, '%Y-%m-%d')AS application_date FROM app_personaldata WHERE app_status = 'For Interview'`, (err, forInterview) =>{
                        if(err){
                            console.log(err)
                        } else{
                            let application = "";
                            let applicationForChecking
                            if(forInterview.length == 0){
                                applicationForInterview = "";
                            } else{
                                applicationForInterview = forInterview[0].application_date;
                            }
                            gdb.query(`SELECT *, DATE_FORMAT(application_date, '%Y-%m-%d')AS application_date FROM app_personaldata WHERE app_status = 'For Checking'`, (err, forChecking) => {
                                if(err){
                                    console.log(err)
                                }else{
                                    if(forChecking.length == 0){
                                        applicationForChecking = "";
                                    }else{
                                        applicationForChecking = forChecking[0].application_date;
                                    }
                                    gdb.query(`SELECT *, DATE_FORMAT(application_date, '%Y-%m-%d')AS application_date FROM app_personaldata WHERE app_status = 'For Updating'`, (err, newDriver) => {
                                        if(err){
                                            console.log(err)
                                        }else{
                                            if(newDriver.length == 0){
                                                applicationNewDriver = "";
                                            }else{
                                                applicationNewDriver = newDriver[0].application_date;
                                            }
                                            gdb.query("SELECT app_personaldata.*, app_licenses.licenseNumber1, app_licenses.licenseExpiry1, app_licenses.licenseType1, app_licenses.licenseRestrictions1, app_familybg.*, app_workexperience.*, app_educationalbg.*, app_qna.* FROM app_personaldata LEFT JOIN app_licenses ON app_personaldata.applicationID = app_licenses.license_ID LEFT JOIN app_familybg ON app_personaldata.applicationID = app_familybg.familybg_ID LEFT JOIN app_workexperience ON app_personaldata.applicationID = app_workexperience.workexperience_ID LEFT JOIN app_educationalbg ON app_personaldata.applicationID = app_educationalbg.educationalbg_ID LEFT JOIN app_qna ON app_personaldata.applicationID = app_qna.qna_ID WHERE app_status = 'For Checking' OR app_status = 'For Interview' OR app_status = 'For Updating'", function (err, data, fields) {
                                                if(err) console.log(err)
                                                else{
                                                    const fastcsv = require("fast-csv");
                                                    const fs = require("fs");
                                                    const ws = fs.createWriteStream("./public/reports/CRT_Applicants.csv", {flag: 'a'});
                                                    const jsonData = JSON.parse(JSON.stringify(data));
                                                    //console.log("jsonData", jsonData);
                                        
                                                    fastcsv.write(jsonData, {headers: true}).on("finish", function(){
                                                        //console.log("Generated Applicants Records CSV");
                                                    }).pipe(ws);

                                                    //INSERT DELETING REJECTED AFTER 30 DAYS
                                                    gdb.query("DELETE FROM app_personaldata WHERE DATE_FORMAT(CURRENT_TIMESTAMP,'%Y-%m-%d-%H-%i-%s') > application_expiration AND app_status='Reject'", function(err){
                                                        if(err){console.log(err)}
                                                        //console.log("Deleted expired applications")
                                                    })                                                   

                                                    res.render('hr_viewapplications', {forChecking: forChecking, forInterview: forInterview, newDriver: newDriver, ad_forChecking: applicationForChecking, ad_forInterview: applicationForInterview, ad_NewDriver: applicationNewDriver, user_name:obj.username});
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })  
                }
            }
        })
    })
}

exports.hr_rejectapplicant = function(req, res){
    let applicantID = req.params.id;

    gdb.query('SELECT * FROM app_personaldata ORDER BY applicationID DESC', (err, result) => {
        if(!err){
          if(result == 0){
            let appid = 1;
            console.log(appid)
          }else{
            let appid = result[0].applicationID + 1;
            console.log(appid)
            gdb.query("UPDATE app_personaldata SET app_status='Reject', application_expiration=DATE_FORMAT(CURRENT_TIMESTAMP+INTERVAL 1 MONTH,'%Y-%m-%d-%H-%i-%s') WHERE applicationID=?", [applicantID], (err) => {
                if(err){
                    console.log(err)
                }else{
                    console.log("Rejected Applicant #"+applicantID)
                    console.log("new base id:"+appid)
                    res.redirect("/hr/viewapplications")
                }
            })
          }
        }      
    })

}

//FOR CHECKING TO FOR INTERVIEW STATUS
exports.hr_forInterviewStatus = function(req, res){
    let applicantID = req.params.id;
    let status = "For Interview";
    //SET THE STATUS OR OVERWRITE THE STATUS FROM TO VIEWING TO TO INTERVIEW
    let sql = "UPDATE app_personaldata SET app_status='" + status + "' WHERE applicationID= '" + applicantID + "';";
    gdb.query(sql, req.body, function (err) {
        if(err) {
        console.log(err)
        }
        else if(!err){
            console.log(applicantID + " was set as For Interview")
            res.redirect('/hr/viewapplications')
        }
    });
}

exports.hr_viewforinterviewdetails = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    let applicantID = req.params.id;
                    gdb.query("SELECT *, DATE_FORMAT(birthdate, '%Y-%m-%d')AS birthdate, DATE_FORMAT(application_date, '%Y-%m-%d')AS application_date FROM app_personaldata WHERE applicationID=?", [applicantID], (err, personaldata) => {
                        if (err) {
                          console.log(err);
                        } else {
                            gdb.query("SELECT * FROM app_educationalbg WHERE educationalbg_ID=?", [applicantID], (err, educational) => {
                                if (err) {
                                  console.log(err);
                                } else {
                                    gdb.query("SELECT * FROM app_workexperience WHERE workexperience_ID=?", [applicantID], (err, work) => {
                                        if (err) {
                                          console.log(err);
                                        } else {
                                            gdb.query("SELECT license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, DATE_FORMAT(licenseExpiry1, '%Y-%m-%d')AS licenseExpiry1 FROM app_licenses WHERE license_ID=?", [applicantID], (err, license) => {
                                                if (err) {
                                                  console.log(err);
                                                } else {
                                                    gdb.query("SELECT *, DATE_FORMAT(father_birthdate, '%Y-%m-%d')AS father_birthdate, DATE_FORMAT(mother_birthdate, '%Y-%m-%d')AS mother_birthdate, DATE_FORMAT(sibling_birthdate1, '%Y-%m-%d')AS sibling_birthdate1, DATE_FORMAT(sibling_birthdate2, '%Y-%m-%d')AS sibling_birhtdate2, DATE_FORMAT(children_birthdate1, '%Y-%m-%d')AS children_birthdate1, DATE_FORMAT(children_birthdate2, '%Y-%m-%d')AS children_birthdate2 FROM app_familybg WHERE familybg_ID=?", [applicantID], (err, family) => {
                                                        if (err) {
                                                          console.log(err);
                                                        } else {
                                                            gdb.query("SELECT documents_ID, profile_photo,sss_number,pagibig_number,tin_number,philhealth_number,facebook,viber FROM app_documents WHERE documents_ID=?", [applicantID], (err, documents) => {
                                                                if (err) {
                                                                    console.log(err);
                                                                } else {
                                                                    //PROFILE PHOTO
                                                                    if(documents[0] == null){
                                                                        res.redirect('/hr/error');
                                                                    } else{
                                                                        let p_profile_photo = "";
                                                                        if(documents[0].profile_photo != null){
                                                                            p_profile_photo = new Buffer.from(documents[0].profile_photo, 'base64');
                                                                        }
                    
                                                                        //LICENSE RESTRICTIONS
                                                                        remove1 = license[0].licenseRestrictions1.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                        splittedr1 = remove1.split(',', '10')
                                                                        restriction1=splittedr1.map(i=>Number(i))
                    
                                                                        if(license[0].licenseRestrictions2 != null){
                                                                            remove2 = license[0].licenseRestrictions2.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                            splittedr2 = remove2.split(',', '10')
                                                                            restriction2=splittedr2.map(i=>Number(i))
                                                                        } else restriction2 = "";
                    
                                                                        res.render('hr_viewforinterviewdetails', {data: personaldata[0], educational: educational[0], work: work[0], license: license[0], family: family[0], restriction1: restriction1, restriction2: restriction2, profile_photo: p_profile_photo, documents: documents[0], user_name:obj.username});
                                                                    }
                                                                }
                                                            })
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            }
        })
    })
}

exports.hr_viewforupdating = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    let applicantID = req.params.id;
                    gdb.query("SELECT *, DATE_FORMAT(birthdate, '%Y-%m-%d')AS birthdate, DATE_FORMAT(application_date, '%Y-%m-%d')AS application_date FROM app_personaldata WHERE applicationID=?", [applicantID], (err, personaldata) => {
                        if (err) {
                          console.log(err);
                        } else {
                            gdb.query("SELECT * FROM app_educationalbg WHERE educationalbg_ID=?", [applicantID], (err, educational) => {
                                if (err) {
                                  console.log(err);
                                } else {
                                    gdb.query("SELECT * FROM app_workexperience WHERE workexperience_ID=?", [applicantID], (err, work) => {
                                        if (err) {
                                          console.log(err);
                                        } else {
                                            gdb.query("SELECT license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, DATE_FORMAT(licenseExpiry1, '%Y-%m-%d')AS licenseExpiry1 FROM app_licenses WHERE license_ID=?", [applicantID], (err, license) => {
                                                if (err) {
                                                  console.log(err);
                                                } else {
                                                    gdb.query("SELECT *, DATE_FORMAT(father_birthdate, '%Y-%m-%d')AS father_birthdate, DATE_FORMAT(mother_birthdate, '%Y-%m-%d')AS mother_birthdate, DATE_FORMAT(sibling_birthdate1, '%Y-%m-%d')AS sibling_birthdate1, DATE_FORMAT(sibling_birthdate2, '%Y-%m-%d')AS sibling_birhtdate2, DATE_FORMAT(children_birthdate1, '%Y-%m-%d')AS children_birthdate1, DATE_FORMAT(children_birthdate2, '%Y-%m-%d')AS children_birthdate2 FROM app_familybg WHERE familybg_ID=?", [applicantID], (err, family) => {
                                                        if (err) {
                                                          console.log(err);
                                                        } else {
                                                            gdb.query("SELECT documents_ID, profile_photo,sss_number,pagibig_number,tin_number,philhealth_number,facebook,viber FROM app_documents WHERE documents_ID=?", [applicantID], (err, documents) => {
                                                                if (err) {
                                                                    console.log(err);
                                                                } else {
                                                                    //PROFILE PHOTO
                                                                    if(documents[0] == null){
                                                                        res.redirect('/hr/error');
                                                                    } else{
                                                                        let p_profile_photo = "";
                                                                        if(documents[0].profile_photo != null){
                                                                            p_profile_photo = new Buffer.from(documents[0].profile_photo, 'base64');
                                                                        }
                                                                        /* let license_file1 = new Buffer.from(license[0].license_file1, 'base64');
                    
                                                                        let license_file2 = new Buffer.from(license[0].license_file2, 'base64'); */
                    
                                                                        //LICENSE RESTRICTIONS
                                                                        remove1 = license[0].licenseRestrictions1.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                        splittedr1 = remove1.split(',', '10')
                                                                        restriction1=splittedr1.map(i=>Number(i))
                    
                                                                        if(license[0].licenseRestrictions2 != null){
                                                                            remove2 = license[0].licenseRestrictions2.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                            splittedr2 = remove2.split(',', '10')
                                                                            restriction2=splittedr2.map(i=>Number(i))
                                                                        } else restriction2 = "";
                    
                                                                        res.render('hr_viewforupdating', {data: personaldata[0], educational: educational[0], work: work[0], license: license[0], family: family[0], restriction1: restriction1, restriction2: restriction2, profile_photo: p_profile_photo, documents: documents[0], user_name:obj.username});
                                                                    }
                                                                }
                                                            })
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            }
        })
    })
}


exports.hr_viewforcheckingdetails = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    let applicantID = req.params.id;
                    gdb.query("SELECT *, DATE_FORMAT(birthdate, '%Y-%m-%d')AS birthdate, DATE_FORMAT(application_date, '%Y-%m-%d')AS application_date FROM app_personaldata WHERE applicationID=?", [applicantID], (err, personaldata) => {
                        if (err) {
                          console.log(err);
                        } else {
                            gdb.query("SELECT * FROM app_educationalbg WHERE educationalbg_ID=?", [applicantID], (err, educational) => {
                                if (err) {
                                  console.log(err);
                                } else {
                                    gdb.query("SELECT * FROM app_workexperience WHERE workexperience_ID=?", [applicantID], (err, work) => {
                                        if (err) {
                                          console.log(err);
                                        } else {
                                            gdb.query("SELECT license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, DATE_FORMAT(licenseExpiry1, '%Y-%m-%d')AS licenseExpiry1 FROM app_licenses WHERE license_ID=?", [applicantID], (err, license) => {
                                                if (err) {
                                                  console.log(err);
                                                } else {
                                                    gdb.query("SELECT *, DATE_FORMAT(father_birthdate, '%Y-%m-%d')AS father_birthdate, DATE_FORMAT(mother_birthdate, '%Y-%m-%d')AS mother_birthdate, DATE_FORMAT(sibling_birthdate1, '%Y-%m-%d')AS sibling_birthdate1, DATE_FORMAT(sibling_birthdate2, '%Y-%m-%d')AS sibling_birhtdate2, DATE_FORMAT(children_birthdate1, '%Y-%m-%d')AS children_birthdate1, DATE_FORMAT(children_birthdate2, '%Y-%m-%d')AS children_birthdate2 FROM app_familybg WHERE familybg_ID=?", [applicantID], (err, family) => {
                                                        if (err) {
                                                          console.log(err);
                                                        } else {
                                                            gdb.query("SELECT documents_ID, profile_photo,sss_number,pagibig_number,tin_number,philhealth_number,facebook,viber FROM app_documents WHERE documents_ID=?", [applicantID], (err, documents) => {
                                                                if (err) {
                                                                    console.log(err);
                                                                } else {
                                                                    if(documents[0] == null){
                                                                        res.redirect('/hr/error');
                                                                    } else{
                                                                        //PROFILE PHOTO
                                                                        let p_profile_photo = new Buffer.from(documents[0].profile_photo, 'base64');
                
                                                                        //LICENSE RESTRICTIONS
                                                                        remove1 = license[0].licenseRestrictions1.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                        splittedr1 = remove1.split(',', '10')
                                                                        restriction1=splittedr1.map(i=>Number(i))
                
                                                                        if(license[0].licenseRestrictions2 != null){
                                                                            remove2 = license[0].licenseRestrictions2.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                            splittedr2 = remove2.split(',', '10')
                                                                            restriction2=splittedr2.map(i=>Number(i))
                                                                        } else restriction2 = "";
                
                                                                        res.render('hr_viewforcheckingdetails', {data: personaldata[0], educational: educational[0], work: work[0], license: license[0], family: family[0], restriction1: restriction1, restriction2: restriction2, profile_photo: p_profile_photo, documents: documents[0], user_name:obj.username});
                                                                    }
                                                                }
                                                            })
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            }
        })
    })
}

//FROM APPLICANT TO DRIVER
exports.hr_addDriver = function(req, res){
    //DATE JOINED
    var date_joined = new Date();
    var dd = date_joined.getDate();
    var mm = date_joined.getMonth()+1;
    var yyyy = date_joined.getFullYear();
    if(dd < 10){
      dd = '0' + dd
    } 
    if(mm < 10){
      mm = '0' + mm
    } 
    date_joined = yyyy + '-' + mm + '-' + dd;
    console.log(date_joined)

    let appid = req.params.id;
    let appid2 = Math.floor(Math.random() * 1000000000);
    //console.log(appid)    

    gdb.query("SELECT * FROM driver_personaldata", (err, driver) => {
        if(err) {                                                            
          console.log("error in selecting applicant personal data")
          console.log(err)
        }else{
            console.log(driver.length);
            if(driver.length == 0){
                appid2 = Math.floor(Math.random() * 1000000000);
                gdb.query("SELECT * FROM app_personaldata WHERE applicationID=?", [appid], (err, data) => {
                    if(err) {                                                            
                      console.log("error in selecting applicant personal data")
                      console.log(err)
                    }
                    else if(!err){
                        let firstName = data[0].firstName;
                        let middleName = data[0].middleName;
                        let lastName = data[0].lastName;
                        let nickname = data[0].nickname;
                        let sex = data[0].sex;
                        let homeAddress = data[0].homeAddress;
                        let birthdate = data[0].birthdate;
                        let location = data[0].location;
                        let personalNumber = data[0].personalNumber;
                        let emailAddress = data[0].emailAddress;
                        let contactPerson_Name = data[0].contactPerson_Name;
                        let contactPerson_Number = data[0].contactPerson_Number;
                        let contactPerson_Relationship = data[0].contactPerson_Relationship;
                        let bloodType = data[0].bloodType;
                        let religion = data[0].religion;
                        let civilStatus = data[0].civilStatus;
                        let height = data[0].height;
                        let weight = data[0].weight;
                        gdb.query("SELECT * FROM app_educationalbg WHERE educationalbg_ID=?", [appid], (err, educational) =>{
                            if(err){
                                console.log("error in selecting applicant educational background")
                                console.log(err)
                            } else{
                                let m_schoolName = educational[0].m_schoolName;
                                let m_from = educational[0].m_from;
                                let m_to = educational[0].m_to;
                                let m_awards = educational[0].m_awards;
                                let c_schoolName = educational[0].c_schoolName;
                                let c_from = educational[0].c_from;
                                let c_to = educational[0].c_to;
                                let c_awards = educational[0].c_awards;
                                let s_schoolName = educational[0].s_schoolName;
                                let s_from = educational[0].s_from;
                                let s_to = educational[0].s_to;
                                let s_awards = educational[0].s_awards;
                                let e_schoolName = educational[0].e_schoolName;
                                let e_from = educational[0].e_from;
                                let e_to = educational[0].e_to;
                                let e_awards = educational[0].e_awards;
                                let o_schoolName = educational[0].o_schoolName;
                                let o_from = educational[0].o_from;
                                let o_to = educational[0].o_to;
                                let o_awards = educational[0].o_awards;
                                let specialSkills = educational[0].specialSkills;
                                gdb.query("SELECT * FROM app_workexperience WHERE workexperience_ID=?", [appid], (err, work) =>{
                                    if(err){
                                        console.log("error in selecting applicant educational background")
                                        console.log(err)
                                    } else{
                                        let workEmployer1 = work[0].workEmployer1;
                                        let workNumber1 = work[0].workNumber1;
                                        let workFrom1 = work[0].workFrom1;
                                        let workTo1 = work[0].workTo1;
                                        let workPosition1 = work[0].workPosition1;
                                        let workReasonForLeaving1 = work[0].workReasonForLeaving1;
                            
                                        let workEmployer2 = work[0].workEmployer2;
                                        let workNumber2 = work[0].workNumber2;
                                        let workFrom2 = work[0].workFrom2;
                                        let workTo2 = work[0].workTo2;
                                        let workPosition2 = work[0].workPosition2;
                                        let workReasonForLeaving2 = work[0].workReasonForLeaving2;
                            
                                        let workEmployer3 = work[0].workEmployer3;
                                        let workNumber3 = work[0].workNumber3;
                                        let workFrom3 = work[0].workFrom3;
                                        let workTo3 = work[0].workTo3;
                                        let workPosition3 = work[0].workPosition3;
                                        let workReasonForLeaving3 = work[0].workReasonForLeaving3;
                                        gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [appid], (err, documents) => {
                                            if(err) {
                                                console.log("error in selecting applicant documents")
                                                console.log(err)
                                            }
                                            else if(!err){
                                                let profile_photo = documents[0].profile_photo;
                                                let sss_file = documents[0].sss_file;
                                                let pagibig_file = documents[0].pagibig_file;
                                                let tin_file = documents[0].tin_file;
                                                let philhealth_file = documents[0].philhealth_file;
                                                let mdr_file = documents[0].mdr_file;
                                                let nbi_file = documents[0].nbi_file;
                                                let brgyclearance_file = documents[0].brgyclearance_file;
                                                let sss_number = documents[0].sss_number;
            
                                                let pagibig_number = documents[0].pagibig_number;
            
                                                let tin_number = documents[0].tin_number;
            
                                                let philhealth_number = documents[0].philhealth_number;
            
                                                let facebook = documents[0].facebook;
                                                let viber = documents[0].viber;
                                                gdb.query("SELECT * FROM app_licenses WHERE license_ID=?", [appid], (err, license) => {
                                                    if(err) {
                                                        console.log("error in selecting applicant license")
                                                        console.log(err)
                                                    }
                                                    else if(!err){
                                                        let licenseNumber1 = license[0].licenseNumber1;
                                                        let licenseExpiry1 = license[0].licenseExpiry1;
                                                        let licenseRating1 = license[0].licenseRating1;
                                                        let licenseRemarks1 = license[0].licenseRemarks1;
                                                        let licenseType1 = license[0].licenseType1;
                                                        let licenseRestrictions1 = license[0].licenseRestrictions1;
                                                        let license_file1 = license[0].license_file1;
                                                        gdb.query("SELECT * FROM app_familybg WHERE familybg_ID=?", [appid], (err,  family) =>{
                                                            if(err){
                                                                console.log("error in selecting applicant family background")
                                                                console.log(err)
                                                            } else{
                                                                let father_name = family[0].father_name;
                                                                let father_companyNumber = family[0].father_companyNumber;
                                                                let father_birthdate = family[0].father_birthdate;
                                                                let father_occupation = family[0].father_occupation;
                                                    
                                                                let mother_name = family[0].mother_name;
                                                                let mother_companyNumber = family[0].mother_companyNumber;
                                                                let mother_birthdate = family[0].mother_birthdate;
                                                                let mother_occupation = family[0].mother_occupation;
                                                    
                                                                let sibling_name1 = family[0].sibling_name1;
                                                                let sibling_companyNumber1 = family[0].sibling_companyNumber1;
                                                                let sibling_birthdate1 = family[0].sibling_birthdate1;
                                                                let sibling_occupation1 = family[0].sibling_occupation1;
                                                    
                                                                let sibling_name2 = family[0].sibling_name2;
                                                                let sibling_companyNumber2 = family[0].sibling_companyNumber2;
                                                                let sibling_birthdate2 = family[0].sibling_birthdate2;
                                                                let sibling_occupation2 = family[0].sibling_occupation2;
                                                    
                                                                let children_name1 = family[0].children_name1;
                                                                let children_birthdate1 = family[0].children_birthdate1;
                                                                let children_name2 = family[0].children_name2;
                                                                let children_birthdate2 = family[0].children_birthdate2;
                                                    
                                                                let personcrt_name1 = family[0].personcrt_name1;
                                                                let personcrt_relationship1 = family[0].personcrt_relationship1;
                                                                let personcrt_name2 = family[0].personcrt_name2;
                                                                let personcrt_relationship2 = family[0].personcrt_relationship2;

                                                                if(father_birthdate == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                    father_birthdate = '0000-00-00';
                                                                }
                                                                if(mother_birthdate == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                    mother_birthdate = '0000-00-00';
                                                                }
                                                                if(sibling_birthdate1 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                    sibling_birthdate1 = '0000-00-00';
                                                                }
                                                                if(sibling_birthdate2 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                    sibling_birthdate2 = '0000-00-00';
                                                                }
                                                                if(children_birthdate1 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                    children_birthdate1 = '0000-00-00';
                                                                }
                                                                if(children_birthdate2 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                    children_birthdate2 = '0000-00-00';
                                                                }

                                                                let driver_status = '"7"'; //ON PROBATION
                                                                gdb.query("INSERT INTO driver_personaldata (driverID, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, 
                                                                    personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined], (err, result) => {
                                                                    if(err) {
                                                                        console.log("error in inserting driver personal data")
                                                                        console.log(err)
                                                                    }
                                                                    else if(!err){
                                                                        gdb.query("INSERT INTO driver_educationalbg (educationalbg_ID, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, 
                                                                        c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills], (err, result) => {
                                                                            if(err) {
                                                                                console.log("error in inserting driver educational background")
                                                                            console.log(err)
                                                                            }
                                                                            else if(!err){
                                                                            gdb.query("INSERT INTO driver_workexperience (workexperience_ID, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, 
                                                                                workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3], (err, result) => {
                                                                                if(err) {
                                                                                    console.log("error in inserting driver work experience")
                                                                                    console.log(err)
                                                                                }
                                                                                else if(!err){
                                                                                    /* console.log("New Applicant: " + firstName + " Application ID: " + appid);
                                                                                    res.redirect('/'); */
                                                                                    gdb.query("INSERT INTO driver_licenses (license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, license_file1) VALUES(?,?,?,?,?,?,?,?)", [appid2, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, license_file1], (err, result) => {
                                                                                    if(err) {
                                                                                        console.log("error in inserting driver license")
                                                                                        console.log(err)
                                                                                    }
                                                                                    else if(!err){
                                                                                        gdb.query("INSERT INTO driver_familybg (familybg_ID, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2], (err, result) => {
                                                                                        if(err) {
                                                                                            console.log("error in inserting driver family bg")
                                                                                            console.log(err)
                                                                                        }
                                                                                        else if(!err){
                                                                                            gdb.query("INSERT INTO driver_documents (documents_ID, profile_photo, sss_number, sss_file, pagibig_number, pagibig_file, tin_number, tin_file, philhealth_number, philhealth_file, mdr_file, nbi_file, brgyclearance_file, facebook, viber) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, profile_photo, sss_number, sss_file, pagibig_number, pagibig_file, tin_number, tin_file, philhealth_number, philhealth_file, mdr_file, nbi_file, brgyclearance_file, facebook, viber], (err, result) => {
                                                                                                if(err) {                                                            
                                                                                                console.log("error in inserting driver documents")
                                                                                                console.log(err)
                                                                                                }else{
                                                                                                    gdb.query("DELETE FROM app_personaldata WHERE applicationID=?", [appid], (err, result) => {
                                                                                                        if(err) {                                                            
                                                                                                        console.log("error in inserting driver documents")
                                                                                                        console.log(err)
                                                                                                        }
                                                                                                        else if(!err){
                                                                                                        console.log("New Driver: " + firstName + " Application ID: " + appid);
                                                                                                        res.redirect('/hr/managedrivers');
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                        });
                                                                                    }
                                                                                    });
                                                                                    }
                                                                                });
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        }) 
                                                    }
                                                });
                                            }
                                        });
                                    }
                                })
                            }
                        }) 
                    }
                });
            } else{
                for(i=0; i<= driver.length; i++){                
                    let pivot = parseInt(driver[i].driverID)
                    let pivot2 = parseInt(appid);
                    //console.log("this is the pivot "+pivot)
                    if(pivot == pivot2){
                        appid2 = Math.floor(Math.random() * 1000000000);
                        continue;
                    }else{
                        gdb.query("SELECT * FROM app_personaldata WHERE applicationID=?", [appid], (err, data) => {
                            if(err) {                                                            
                              console.log("error in selecting applicant personal data")
                              console.log(err)
                            }
                            else if(!err){
                                let firstName = data[0].firstName;
                                let middleName = data[0].middleName;
                                let lastName = data[0].lastName;
                                let nickname = data[0].nickname;
                                let sex = data[0].sex;
                                let homeAddress = data[0].homeAddress;
                                let birthdate = data[0].birthdate;
                                let location = data[0].location;
                                let personalNumber = data[0].personalNumber;
                                let emailAddress = data[0].emailAddress;
                                let contactPerson_Name = data[0].contactPerson_Name;
                                let contactPerson_Number = data[0].contactPerson_Number;
                                let contactPerson_Relationship = data[0].contactPerson_Relationship;
                                let bloodType = data[0].bloodType;
                                let religion = data[0].religion;
                                let civilStatus = data[0].civilStatus;
                                let height = data[0].height;
                                let weight = data[0].weight;
                                gdb.query("SELECT * FROM app_educationalbg WHERE educationalbg_ID=?", [appid], (err, educational) =>{
                                    if(err){
                                        console.log("error in selecting applicant educational background")
                                        console.log(err)
                                    } else{
                                        let m_schoolName = educational[0].m_schoolName;
                                        let m_from = educational[0].m_from;
                                        let m_to = educational[0].m_to;
                                        let m_awards = educational[0].m_awards;
                                        let c_schoolName = educational[0].c_schoolName;
                                        let c_from = educational[0].c_from;
                                        let c_to = educational[0].c_to;
                                        let c_awards = educational[0].c_awards;
                                        let s_schoolName = educational[0].s_schoolName;
                                        let s_from = educational[0].s_from;
                                        let s_to = educational[0].s_to;
                                        let s_awards = educational[0].s_awards;
                                        let e_schoolName = educational[0].e_schoolName;
                                        let e_from = educational[0].e_from;
                                        let e_to = educational[0].e_to;
                                        let e_awards = educational[0].e_awards;
                                        let o_schoolName = educational[0].o_schoolName;
                                        let o_from = educational[0].o_from;
                                        let o_to = educational[0].o_to;
                                        let o_awards = educational[0].o_awards;
                                        let specialSkills = educational[0].specialSkills;
                                        gdb.query("SELECT * FROM app_workexperience WHERE workexperience_ID=?", [appid], (err, work) =>{
                                            if(err){
                                                console.log("error in selecting applicant educational background")
                                                console.log(err)
                                            } else{
                                                let workEmployer1 = work[0].workEmployer1;
                                                let workNumber1 = work[0].workNumber1;
                                                let workFrom1 = work[0].workFrom1;
                                                let workTo1 = work[0].workTo1;
                                                let workPosition1 = work[0].workPosition1;
                                                let workReasonForLeaving1 = work[0].workReasonForLeaving1;
                                    
                                                let workEmployer2 = work[0].workEmployer2;
                                                let workNumber2 = work[0].workNumber2;
                                                let workFrom2 = work[0].workFrom2;
                                                let workTo2 = work[0].workTo2;
                                                let workPosition2 = work[0].workPosition2;
                                                let workReasonForLeaving2 = work[0].workReasonForLeaving2;
                                    
                                                let workEmployer3 = work[0].workEmployer3;
                                                let workNumber3 = work[0].workNumber3;
                                                let workFrom3 = work[0].workFrom3;
                                                let workTo3 = work[0].workTo3;
                                                let workPosition3 = work[0].workPosition3;
                                                let workReasonForLeaving3 = work[0].workReasonForLeaving3;
                                                gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [appid], (err, documents) => {
                                                    if(err) {
                                                        console.log("error in selecting applicant documents")
                                                        console.log(err)
                                                    }
                                                    else if(!err){
                                                        let profile_photo = documents[0].profile_photo;
                                                        let sss_file = documents[0].sss_file;
                                                        let pagibig_file = documents[0].pagibig_file;
                                                        let tin_file = documents[0].tin_file;
                                                        let philhealth_file = documents[0].philhealth_file;
                                                        let mdr_file = documents[0].mdr_file;
                                                        let nbi_file = documents[0].nbi_file;
                                                        let brgyclearance_file = documents[0].brgyclearance_file;
                                                        let sss_number = documents[0].sss_number;
                    
                                                        let pagibig_number = documents[0].pagibig_number;
                    
                                                        let tin_number = documents[0].tin_number;
                    
                                                        let philhealth_number = documents[0].philhealth_number;
                    
                                                        let facebook = documents[0].facebook;
                                                        let viber = documents[0].viber;
                                                        gdb.query("SELECT * FROM app_licenses WHERE license_ID=?", [appid], (err, license) => {
                                                            if(err) {
                                                                console.log("error in selecting applicant license")
                                                                console.log(err)
                                                            }
                                                            else if(!err){
                                                                let licenseNumber1 = license[0].licenseNumber1;
                                                                let licenseExpiry1 = license[0].licenseExpiry1;
                                                                let licenseRating1 = license[0].licenseRating1;
                                                                let licenseRemarks1 = license[0].licenseRemarks1;
                                                                let licenseType1 = license[0].licenseType1;
                                                                let licenseRestrictions1 = license[0].licenseRestrictions1;
                                                                let license_file1 = license[0].license_file1;
                                                                gdb.query("SELECT * FROM app_familybg WHERE familybg_ID=?", [appid], (err,  family) =>{
                                                                    if(err){
                                                                        console.log("error in selecting applicant family background")
                                                                        console.log(err)
                                                                    } else{
                                                                        
                                                                        let father_name = family[0].father_name;
                                                                        let father_companyNumber = family[0].father_companyNumber;
                                                                        let father_birthdate = family[0].father_birthdate;
                                                                        let father_occupation = family[0].father_occupation;
                                                            
                                                                        let mother_name = family[0].mother_name;
                                                                        let mother_companyNumber = family[0].mother_companyNumber;
                                                                        let mother_birthdate = family[0].mother_birthdate;
                                                                        let mother_occupation = family[0].mother_occupation;
                                                            
                                                                        let sibling_name1 = family[0].sibling_name1;
                                                                        let sibling_companyNumber1 = family[0].sibling_companyNumber1;
                                                                        let sibling_birthdate1 = family[0].sibling_birthdate1;
                                                                        let sibling_occupation1 = family[0].sibling_occupation1;
                                                            
                                                                        let sibling_name2 = family[0].sibling_name2;
                                                                        let sibling_companyNumber2 = family[0].sibling_companyNumber2;
                                                                        let sibling_birthdate2 = family[0].sibling_birthdate2;
                                                                        let sibling_occupation2 = family[0].sibling_occupation2;
                                                            
                                                                        let children_name1 = family[0].children_name1;
                                                                        let children_birthdate1 = family[0].children_birthdate1;
                                                                        let children_name2 = family[0].children_name2;
                                                                        let children_birthdate2 = family[0].children_birthdate2;
                                                            
                                                                        let personcrt_name1 = family[0].personcrt_name1;
                                                                        let personcrt_relationship1 = family[0].personcrt_relationship1;
                                                                        let personcrt_name2 = family[0].personcrt_name2;
                                                                        let personcrt_relationship2 = family[0].personcrt_relationship2;
                                                                        
                                                                        //BIRTHDATES OF FAMILY THAT DOESN'T HAVE VALUE
                                                                        if(father_birthdate == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                            father_birthdate = '0000-00-00';
                                                                        }
                                                                        if(mother_birthdate == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                            mother_birthdate = '0000-00-00';
                                                                        }
                                                                        if(sibling_birthdate1 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                            sibling_birthdate1 = '0000-00-00';
                                                                        }
                                                                        if(sibling_birthdate2 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                            sibling_birthdate2 = '0000-00-00';
                                                                        }
                                                                        if(children_birthdate1 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                            children_birthdate1 = '0000-00-00';
                                                                        }
                                                                        if(children_birthdate2 == 'Thu Nov 30 1899 00:00:00 GMT+0655 (Singapore Standard Time)'){
                                                                            children_birthdate2 = '0000-00-00';
                                                                        }

                                                                        let driver_status = '"7"'; //ON PROBATION
                                                                        gdb.query("INSERT INTO driver_personaldata (driverID, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, 
                                                                            personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined], (err, result) => {
                                                                            if(err) {
                                                                                console.log("error in inserting driver personal data")
                                                                                console.log(err)
                                                                            }
                                                                            else if(!err){
                                                                                gdb.query("INSERT INTO driver_educationalbg (educationalbg_ID, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, 
                                                                                c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills], (err, result) => {
                                                                                    if(err) {
                                                                                        console.log("error in inserting driver educational background")
                                                                                    console.log(err)
                                                                                    }
                                                                                    else if(!err){
                                                                                    gdb.query("INSERT INTO driver_workexperience (workexperience_ID, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, 
                                                                                        workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3], (err, result) => {
                                                                                        if(err) {
                                                                                            console.log("error in inserting driver work experience")
                                                                                            console.log(err)
                                                                                        }
                                                                                        else if(!err){
                                                                                            /* console.log("New Applicant: " + firstName + " Application ID: " + appid);
                                                                                            res.redirect('/'); */
                                                                                            gdb.query("INSERT INTO driver_licenses (license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, license_file1) VALUES(?,?,?,?,?,?,?,?)", [appid2, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, license_file1], (err, result) => {
                                                                                            if(err) {
                                                                                                console.log("error in inserting driver license")
                                                                                                console.log(err)
                                                                                            }
                                                                                            else if(!err){
                                                                                                gdb.query("INSERT INTO driver_familybg (familybg_ID, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2], (err, result) => {
                                                                                                if(err) {
                                                                                                    console.log("error in inserting driver family bg")
                                                                                                    console.log(err)
                                                                                                }
                                                                                                else if(!err){
                                                                                                    gdb.query("INSERT INTO driver_documents (documents_ID, profile_photo, sss_number, sss_file, pagibig_number, pagibig_file, tin_number, tin_file, philhealth_number, philhealth_file, mdr_file, nbi_file, brgyclearance_file, facebook, viber) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid2, profile_photo, sss_number, sss_file, pagibig_number, pagibig_file, tin_number, tin_file, philhealth_number, philhealth_file, mdr_file, nbi_file, brgyclearance_file, facebook, viber], (err, result) => {
                                                                                                        if(err) {                                                            
                                                                                                        console.log("error in inserting driver documents")
                                                                                                        console.log(err)
                                                                                                        }else{
                                                                                                            gdb.query("DELETE FROM app_personaldata WHERE applicationID=?", [appid], (err, result) => {
                                                                                                                if(err) {                                                            
                                                                                                                console.log("error in inserting driver documents")
                                                                                                                console.log(err)
                                                                                                                }
                                                                                                                else if(!err){
                                                                                                                    //console.log("dad's birthday: " +family[0].father_birthdate)
                                                                                                                    console.log("New Driver: " + firstName + " Application ID: " + appid);
                                                                                                                    res.redirect('/hr/managedrivers');
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                                });
                                                                                            }
                                                                                            });
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                });
                                                                            }
                                                                        });
                                                                    }
                                                                }) 
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        })
                                    }
                                }) 
                            }
                        }); break;
                    }
                }

            }
        }
    })
}

//ADD NEW DRIVER UI
exports.hr_addnewdriver = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    res.render('hr_addnewdriver', {user_name:obj.username})
                }
            }
        })
    })
}

//ADD NEW DRIVER POST (MANUAL DRIVER)
exports.hr_addnewdriverpost = function(req, res){
    if(req.method == "POST"){
        //PERSONAL DATA
        let post = req.body;
        let firstName = post.firstName;
        let middleName = post.middleName;
        let lastName = post.lastName;
        let nickname = post.nickname;
        let sex = post.sex;
        let homeAddress = post.homeAddress;
        let birthdate = post.birthdate;
        let location = post.location;
        let personalNumber = post.personalNumber;
        let emailAddress = post.emailAddress;
        let contactPerson_Name = post.contactPerson_Name;
        let contactPerson_Number = post.contactPerson_Number;
        let contactPerson_Relationship = post.contactPerson_Relationship;
        let bloodType = post.bloodType;
        let religion = post.religion;
        let civilStatus = post.civilStatus;
        let height = post.height;
        let weight = post.weight;
        let app_status = "For Checking";

        //EDUCATIONAL BACKGROUND
        let m_schoolName = post.m_schoolName;
        let m_from = post.m_from;
        if(m_from == ''){
            m_from = 0;
        }//
        let m_to = post.m_to;
        if(m_to == ''){
            m_to = 0;
        }//
        let m_awards = post.m_awards;

        let c_schoolName = post.c_schoolName;
        let c_from = post.c_from;
        if(c_from == ''){
            c_from = 0;
        }//
        let c_to = post.c_to;
        if(c_to == ''){
            c_to = 0;
        }//
        let c_awards = post.c_awards;

        let s_schoolName = post.s_schoolName;
        let s_from = post.s_from;
        if(s_from == ''){
            s_from = 0;
        }//
        let s_to = post.s_to;
        if(s_to == ''){
            s_to = 0;
        }//
        let s_awards = post.s_awards;

        let e_schoolName = post.e_schoolName;
        let e_from = post.e_from;
        if(e_from == ''){
            e_from = 0;
        }//
        let e_to = post.e_to;
        if(e_to == ''){
            e_to = 0;
        }//
        let e_awards = post.e_awards;

        let o_schoolName = post.o_schoolName;
        let o_from = post.o_from;
        if(o_from == ''){
            o_from = 0;
        }//
        let o_to = post.o_to;
        if(o_to == ''){
            o_to = 0;
        }//
        let o_awards = post.o_awards;

        let specialSkills = post.specialSkills;

        //WORK EXPERIENCE
        let workEmployer1 = post.workEmployer1;
        let workNumber1 = post.workNumber1;
        if(workNumber1 == ''){
            workNumber1 = 0;
        }//
        let workFrom1 = post.workFrom1;
        if(workFrom1 == ''){
            workFrom1 = 0;
        }//
        let workTo1 = post.workTo1;
        if(workTo1 == ''){
            workTo1 = 0;
        }//
        let workPosition1 = post.workPosition1;
        let workReasonForLeaving1 =  post.workReasonForLeaving1;

        let workEmployer2 = post.workEmployer2;
        let workNumber2 = post.workNumber2;
        if(workNumber2 == ''){
            workNumber2 = 0;
        }//
        let workFrom2 = post.workFrom2;
        if(workFrom2 == ''){
            workFrom2 = 0;
        }//
        let workTo2 = post.workTo2;
        if(workTo2 == ''){
            workTo2 = 0;
        }//
        let workPosition2 = post.workPosition2;
        let workReasonForLeaving2 =  post.workReasonForLeaving2;

        let workEmployer3 = post.workEmployer3;
        let workNumber3 = post.workNumber3;
        if(workNumber3 == ''){
            workNumber3 = 0;
        }//
        let workFrom3 = post.workFrom3;
        if(workFrom3 == ''){
            workFrom3 = 0;
        }//
        let workTo3 = post.workTo3;
        if(workTo3 == ''){
            workTo3 = 0;
        }//
        let workPosition3 = post.workPosition3;
        let workReasonForLeaving3 =  post.workReasonForLeaving3;

        //LICENSES
        let licenseNumber1 = post.licenseNumber1;
        let licenseExpiry1 = post.licenseExpiry1;
        let licenseRating1 = post.licenseRating1;
        let licenseRemarks1 = post.licenseRemarks1;
        let licenseType1 = post.licenseType1;
        let licenseRestrictions1 = post.restriction1;
        let licenseRestrictionStringed1 = JSON.stringify(licenseRestrictions1);

        //FAMILY BACKGROUND
        let father_name = post.father_name;
        let father_companyNumber = post.father_companyNumber;
        if(father_companyNumber == ''){
            father_companyNumber = 0;
        }//
        let father_birthdate = post.father_birthdate;
        if(father_birthdate == ''){
            father_birthdate = '1111-01-01';
        }//
        let father_occupation = post.father_occupation;

        let mother_name = post.mother_name;
        let mother_companyNumber = post.mother_companyNumber;
        if(mother_companyNumber == ''){
            mother_companyNumber = 0;
        }//
        let mother_birthdate = post.mother_birthdate;
        if(mother_birthdate == ''){
            mother_birthdate = '1111-01-01';
        }//
        let mother_occupation = post.mother_occupation;

        let sibling_name1 = post.sibling_name1;
        let sibling_companyNumber1 = post.sibling_companyNumber1;
        if(sibling_companyNumber1 == ''){
            sibling_companyNumber1 = 0;
        }//
        let sibling_birthdate1 = post.sibling_birthdate1;
        if(sibling_birthdate1 == ''){
            sibling_birthdate1 = '1111-01-01';
        }//
        let sibling_occupation1 = post.sibling_occupation1;

        let sibling_name2 = post.sibling_name2;
        let sibling_companyNumber2 = post.sibling_companyNumber2;
        if(sibling_companyNumber2 == ''){
            sibling_companyNumber2 = 0;
        }//
        let sibling_birthdate2 = post.sibling_birthdate2;
        if(sibling_birthdate2 == ''){
            sibling_birthdate2 = '1111-01-01';
        }//
        let sibling_occupation2 = post.sibling_occupation2;

        let children_name1 = post.children_name1;
        let children_birthdate1 = post.children_birthdate1;
        if(children_birthdate1 == ''){
            children_birthdate1 = '1111-01-01';
        }//
        let children_name2 = post.children_name2;
        let children_birthdate2 = post.children_birthdate2;
        if(children_birthdate2 == ''){
            children_birthdate2 = '1111-01-01';
        }//

        let personcrt_name1 = post.personcrt_name1;
        let personcrt_relationship1 = post.personcrt_relationship1;
        let personcrt_name2 = post.personcrt_name2;
        let personcrt_relationship2 = post.personcrt_relationship2;

        //ATTACHMENTS
        let sss_number = post.sss_number;
        if(sss_number == ''){
            sss_number = 0;
        }//

        let pagibig_number = post.pagibig_number;
        if(pagibig_number == ''){
            pagibig_number = 0;
        }//

        let tin_number = post.tin_number;
        if(tin_number == ''){
            tin_number = 0;
        }//

        let philhealth_number = post.philhealth_number;
        if(philhealth_number == ''){
            philhealth_number = 0;
        }//

        let facebook = post.facebook;
        let viber = post.viber;

        //DATE OF APPLICATION
        var date_joined = new Date();
        var dd = date_joined.getDate();
        var mm = date_joined.getMonth()+1;
        var yyyy = date_joined.getFullYear();
        if(dd < 10){
        dd = '0' + dd
        } 
        if(mm < 10){
        mm = '0' + mm
        } 
        date_joined = yyyy + '-' + mm + '-' + dd;
        //console.log(date_joined)

        if(!req.files){     
        gdb.query('SELECT * FROM driver_personaldata ORDER BY driverID DESC', (err, result) => {
            if (err) {
                console.log(err);
            } else {
                let appid = Math.floor(Math.random() * 1000000000);
                for(i=0; i<=result.length; i++){
                    if(result.length == 0){
                        appid = Math.floor(Math.random() * 1000000000);
                    }else if(result[0].driverID == appid){
                        appid = Math.floor(Math.random() * 1000000000); //FIX THIS ROBIN
                        continue;
                    }else{
                        //retain random appid
                    }   
                }
                //console.log(parseInt(appid));
                let driver_status = '"7"'; //ON PROBATION
                gdb.query("INSERT INTO driver_personaldata (driverID, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined], (err, result) => {
                    if(err) {
                        console.log(err)
                        let message = 'Please only include alphanumeric characters';
                        res.render('/', {message: message});
                    }
                    else if(!err){
                        gdb.query("INSERT INTO driver_educationalbg (educationalbg_ID, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, 
                        c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills], (err, result) => {
                            if(err) {
                            console.log(err)
                            let message = 'Please only include alphanumeric characters';
                            res.render('home', {message: message});
                            }
                            else if(!err){
                            gdb.query("INSERT INTO driver_workexperience (workexperience_ID, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, 
                                workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3], (err, result) => {
                                if(err) {
                                    console.log(err)
                                    let message = 'Please only include alphanumeric characters';
                                    res.render('home', {message: message});
                                }
                                else if(!err){
                                    /* console.log("New Applicant: " + firstName + " Application ID: " + appid);
                                    res.redirect('/'); */
                                    gdb.query("INSERT INTO driver_licenses (license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1) VALUES(?,?,?,?,?,?,?)", [appid, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictionStringed1], (err, result) => {
                                    if(err) {
                                        console.log(err)
                                        let message = 'Please only include alphanumeric characters';
                                        res.render('home', {message: message});
                                    }
                                    else if(!err){
                                        gdb.query("INSERT INTO driver_familybg (familybg_ID, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2], (err, result) => {
                                        if(err) {
                                            console.log(err)
                                            let message = 'Please only include alphanumeric characters';
                                            res.render('home', {message: message});
                                        }
                                        else if(!err){
                                            gdb.query("INSERT INTO driver_documents (documents_ID, sss_number, pagibig_number, tin_number, philhealth_number, facebook, viber) VALUES(?,?,?,?,?,?,?)", [appid, sss_number, pagibig_number, tin_number, philhealth_number, facebook, viber], (err, result) => {
                                                if(err) {
                                                    console.log(err)
                                                    let message = 'Please only include alphanumeric characters';
                                                    res.render('home', {message: message});
                                                }
                                                else if(!err){
                                                    console.log("New Applicant: " + firstName + " Application ID: " + appid);
                                                    res.redirect('/hr/managedrivers');
                                                }
                                            });
                                        }
                                        });
                                    }
                                    });
                                }
                                });
                            }
                        });
                    }
                    });
                };
            })
        } 
        else{
        let profile_photo ="";
        if(!req.files.profile_photo) {
            profile_photo = "";
        }
        else {        
            raw_profile_photo = req.files.profile_photo.data;
            let buff_raw_profile_photo = new Buffer.from(raw_profile_photo);
            profile_photo = buff_raw_profile_photo.toString('base64');
            //console.log('profile photo uploaded');
        }

        let sss_file = "";
        if(!req.files.sss_file) {
            sss_file = "";
        }
        else {
            raw_sss_file = req.files.sss_file.data;
            let buff_raw_sss_file = new Buffer.from(raw_sss_file);
            sss_file = buff_raw_sss_file.toString('base64');
            //console.log('profile photo uploaded');
        }

        let pagibig_file = "";
        if(!req.files.pagibig_file) {
            pagibig_file = "";
        }
        else {
            raw_pagibig_file = req.files.pagibig_file.data;
            let buff_raw_pagibig_file = new Buffer.from(raw_pagibig_file);
            pagibig_file = buff_raw_pagibig_file.toString('base64');
            //console.log('pagibig file uploaded');
        }

        let tin_file = "";
        if(!req.files.tin_file) {
            tin_file = "";
        }
        else {
            raw_tin_file = req.files.tin_file.data;
            let buff_raw_tin_file = new Buffer.from(raw_tin_file);
            tin_file = buff_raw_tin_file.toString('base64');
            //console.log('tin file uploaded');
        }

        let license_file1 = "";
        if(!req.files.license_file1) {
            license_file1 = "";
        }
        else {
            raw_license_file1 = req.files.license_file1.data;
            let buff_raw_license_file1 = new Buffer.from(raw_license_file1);
            license_file1 = buff_raw_license_file1.toString('base64');
            //console.log('driver license 1 file uploaded');
        }

        let philhealth_file = "";
        if(!req.files.philhealth_file) {
            philhealth_file = "";
        }
        else {
            raw_philhealth_file = req.files.philhealth_file.data;
            let buff_raw_philhealth_file = new Buffer.from(raw_philhealth_file);
            philhealth_file = buff_raw_philhealth_file.toString('base64');
            //console.log('philhealth file uploaded');
        }

        let mdr_file = "";
        if(!req.files.mdr_file) {
            mdr_file = "";
        }
        else {
            raw_mdr_file = req.files.mdr_file.data;
            let buff_raw_mdr_file = new Buffer.from(raw_mdr_file);
            mdr_file = buff_raw_mdr_file.toString('base64');
            //console.log('mdr file uploaded');
        }

        let nbi_file = "";
        if(!req.files.nbi_file) {
            nbi_file = "";
        }
        else {
            raw_nbi_file = req.files.nbi_file.data;
            let buff_raw_nbi_file = new Buffer.from(raw_nbi_file);
            nbi_file = buff_raw_nbi_file.toString('base64');
            //console.log('nbi file uploaded');
        }

        let brgyclearance_file = ""; 
        if(!req.files.brgyclearance_file) {
            brgyclearance_file = "";
        }
        else {
            raw_brgyclearance_file = req.files.brgyclearance_file.data;
            let buff_raw_brgyclearance_file = new Buffer.from(raw_brgyclearance_file);
            brgyclearance_file = buff_raw_brgyclearance_file.toString('base64');
            //console.log('brgy clearance file uploaded');
        }

        gdb.query('SELECT * FROM driver_personaldata ORDER BY driverID DESC', (err, result) => {
            if (err) {
                console.log(err);
            } else {
            let appid = Math.floor(Math.random() * 1000000000);
            for(i=0; i<=result.length; i++){
                if(result.length == 0){
                    appid = Math.floor(Math.random() * 1000000000);
                }else if(result[0].driverID == appid){
                    appid = Math.floor(Math.random() * 1000000000); //FIX THIS ROBIN
                    continue;
                }else{
                    //retain random appid
                }   
            }
            //console.log(parseInt(appid));
            let driver_status = '"7"'; //ON PROBATION
            gdb.query("INSERT INTO driver_personaldata (driverID, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location,
                personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, date_joined], (err, result) => {
                if(err) {
                    console.log(err)
                    let message = 'Please only include alphanumeric characters';
                    res.render('/', {message: message});
                }
                else if(!err){
                    gdb.query("INSERT INTO driver_educationalbg (educationalbg_ID, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, 
                    c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills], (err, result) => {
                        if(err) {
                        console.log(err)
                        let message = 'Please only include alphanumeric characters';
                        res.render('home', {message: message});
                        }
                        else if(!err){
                        gdb.query("INSERT INTO driver_workexperience (workexperience_ID, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, 
                            workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3], (err, result) => {
                            if(err) {
                                console.log(err)
                                let message = 'Please only include alphanumeric characters';
                                res.render('home', {message: message});
                            }
                            else if(!err){
                                /* console.log("New Applicant: " + firstName + " Application ID: " + appid);
                                res.redirect('/'); */
                                gdb.query("INSERT INTO driver_licenses (license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, license_file1) VALUES(?,?,?,?,?,?,?,?)", [appid, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictionStringed1, license_file1], (err, result) => {
                                if(err) {
                                    console.log(err)
                                    let message = 'Please only include alphanumeric characters';
                                    res.render('home', {message: message});
                                }
                                else if(!err){
                                    gdb.query("INSERT INTO driver_familybg (familybg_ID, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2], (err, result) => {
                                    if(err) {
                                        console.log(err)
                                        let message = 'Please only include alphanumeric characters';
                                        res.render('home', {message: message});
                                    }
                                    else if(!err){
                                        gdb.query("INSERT INTO driver_documents (documents_ID, profile_photo, sss_number, sss_file, pagibig_number, pagibig_file, tin_number, tin_file, philhealth_number, philhealth_file, mdr_file, nbi_file, brgyclearance_file, facebook, viber) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [appid, profile_photo, sss_number, sss_file, pagibig_number, pagibig_file, tin_number, tin_file, philhealth_number,philhealth_file, mdr_file, nbi_file, brgyclearance_file, facebook, viber], (err, result) => {
                                            if(err) {
                                                console.log(err)
                                                let message = 'Please only include alphanumeric characters';
                                                res.render('home', {message: message});
                                            }
                                            else if(!err){
                                                console.log("New Applicant: " + firstName + " Application ID: " + appid);
                                                res.redirect('/hr/home');
                                            }
                                            });
                                    }
                                    });
                                }
                                });
                            }
                            });
                        }
                    });
                }
                });
            };
        });    
        }
    }  else {
        console.log("error")
        res.redirect("home")
    }
}

exports.hr_viewessayanswers = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You cannot access an HR site due to being an Admin of the system")
                    res.redirect('/admin/home')
                }else{
                    var obj = result[0]
                    let applicantID = req.params.id;
                    gdb.query("SELECT * FROM app_personaldata WHERE applicationID=?", [applicantID], (err, data) =>{
                        if(err) console.log(err);
                        else{
                            gdb.query("SELECT * FROM app_qna WHERE qna_ID=?", [applicantID], (err, essay) => {
                                if (err) {
                                  console.log(err);
                                } else {
                                    if(essay[0] == null){
                                        res.redirect('/hr/error');
                                    } else{
                                        res.render('hr_viewessayanswers', {essay: essay[0], data: data[0], user_name:obj.username});
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

//FILES VIEW
//APPLICANT FILES
exports.hr_license1 = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_licenses WHERE license_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].license_file1;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_sss = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].sss_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_pagibig = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].pagibig_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_tin = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].tin_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_philhealth = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].philhealth_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_mdr = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].mdr_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_nbi = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].nbi_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_brgyclearance = function(req,res){
    let applicantID = req.params.id;
    gdb.query("SELECT * FROM app_documents WHERE documents_ID=?", [applicantID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].brgyclearance_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

//DRIVER FILES
exports.hr_driver_license1 = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_licenses WHERE license_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].license_file1;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_driver_sss = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].sss_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_driver_pagibig = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].pagibig_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_driver_tin = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].tin_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_driver_philhealth = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].philhealth_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_driver_mdr = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].mdr_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_driver_nbi = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].nbi_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

exports.hr_driver_brgyclearance = function(req,res){
    let driverID = req.params.id;
    gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [driverID], (err, result) =>{
        if(err){
            console.log(err);
        } else{
            if(result[0] == null){
                res.redirect('/hr/error')
            } else{
                let base64String = result[0].brgyclearance_file;
                const theFile = Buffer.from(base64String.toString('utf-8'), 'base64');
                res.end(theFile)
            }
        }
    })
}

//VIEW AND EDIT DRIVER DETAILS
exports.hr_viewdriverdetails = function(req, res){
    gdb.connect(function(err){
        if (err) {console.log(err);}
        var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
        gdb.query(sql,[req.session.passport.user], function(err,result){
            if(err){
                console.log(err)
            }else{
                if(result[0] == null){
                    console.log("You are not an admin. You cannot acess admin UI.")
                    res.redirect('/hr/home')
                }else{
                    var obj = result[0]
                    let driverID = req.params.id;
                    gdb.query("SELECT *, DATE_FORMAT(birthdate, '%Y-%m-%d')AS birthdate, DATE_FORMAT(date_joined, '%Y-%m-%d')AS date_joined FROM driver_personaldata WHERE driverID=?", [driverID], (err, personaldata) => {
                        if (err) {
                        console.log(err);
                        } else {
                            gdb.query("SELECT * FROM driver_educationalbg WHERE educationalbg_ID=?", [driverID], (err, educational) => {
                                if (err) {
                                console.log(err);
                                } else {
                                    gdb.query("SELECT * FROM driver_workexperience WHERE workexperience_ID=?", [driverID], (err, work) => {
                                        if (err) {
                                        console.log(err);
                                        } else {
                                            gdb.query("SELECT license_ID, licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictions1, DATE_FORMAT(licenseExpiry1, '%Y-%m-%d')AS licenseExpiry1 FROM driver_licenses WHERE license_ID=?", [driverID], (err, license) => {
                                                if (err) {
                                                console.log(err);
                                                } else {
                                                    gdb.query("SELECT *, DATE_FORMAT(father_birthdate, '%Y-%m-%d')AS father_birthdate, DATE_FORMAT(mother_birthdate, '%Y-%m-%d')AS mother_birthdate, DATE_FORMAT(sibling_birthdate1, '%Y-%m-%d')AS sibling_birthdate1, DATE_FORMAT(sibling_birthdate2, '%Y-%m-%d')AS sibling_birthdate2, DATE_FORMAT(children_birthdate1, '%Y-%m-%d')AS children_birthdate1, DATE_FORMAT(children_birthdate2, '%Y-%m-%d')AS children_birthdate2 FROM driver_familybg WHERE familybg_ID=?", [driverID], (err, family) => {
                                                        if (err) {
                                                        console.log(err);
                                                        } else {
                                                            gdb.query("SELECT documents_ID, profile_photo,sss_number,pagibig_number,tin_number,philhealth_number,facebook,viber FROM driver_documents WHERE documents_ID=?", [driverID], (err, documents) => {
                                                                if (err) {
                                                                    console.log(err);
                                                                } else {
                                                                    if(documents[0] == null){
                                                                        res.redirect('/hr/error')
                                                                    } else{
                                                                        //PROFILE PHOTO
                                                                    let p_profile_photo = "";
                                                                    if(documents[0].profile_photo != null){
                                                                        p_profile_photo = new Buffer.from(documents[0].profile_photo, 'base64');
                                                                    }

                                                                    //LICENSE RESTRICTIONS
                                                                    remove1 = license[0].licenseRestrictions1.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                    splittedr1 = remove1.split(',', '10')
                                                                    restriction1=splittedr1.map(i=>Number(i))

                                                                    //LICENSE RESTRICTIONS
                                                                    remove2 = personaldata[0].driver_status.replace(/"/g,'').replace('[', '').replace(']', '');
                                                                    splitds = remove2.split(',', '10')
                                                                    driver_status=splitds.map(i=>Number(i))

                                                                    res.render('hr_viewdriverdetails', {data: personaldata[0], educational: educational[0], work: work[0], license: license[0], family: family[0], restriction1: restriction1, driver_status: driver_status, profile_photo: p_profile_photo, documents: documents[0],user_name:obj.username});
                                                                    }
                                                                
                                                                }
                                                            })
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })  
                }
            }
        })
    })
}

//EDIT DRIVER DETAILS POST
exports.hr_editdriverdetails = function(req, res){
    //PERSONAL DATA
    let post = req.body;
    let firstName = post.firstName;
    let middleName = post.middleName;
    let lastName = post.lastName;
    let nickname = post.nickname;
    let sex = post.sex;
    let homeAddress = post.homeAddress;
    let birthdate = post.birthdate;
    if(birthdate == ''){
        birthdate = '1111-01-01';
    }//
    let location = post.location;
    let personalNumber = post.personalNumber;
    let emailAddress = post.emailAddress;
    let contactPerson_Name = post.contactPerson_Name;
    let contactPerson_Number = post.contactPerson_Number;
    let contactPerson_Relationship = post.contactPerson_Relationship;
    let bloodType = post.bloodType;
    let religion = post.religion;
    let civilStatus = post.civilStatus;
    let height = post.height;
    let weight = post.weight;

    //EDUCATIONAL BACKGROUND
    let m_schoolName = post.m_schoolName;
    let m_from = post.m_from;
    if(m_from == ''){
        m_from = 0;
    }//
    let m_to = post.m_to;
    if(m_from == ''){
        m_from = 0;
    }//
    let m_awards = post.m_awards;

    let c_schoolName = post.c_schoolName;
    let c_from = post.c_from;
    if(c_from == ''){
        c_from = 0;
    }//
    let c_to = post.c_to;
    if(c_to == ''){
        c_to = 0;
    }//
    let c_awards = post.c_awards;

    let s_schoolName = post.s_schoolName;
    let s_from = post.s_from;
    if(s_from == ''){
        s_from = 0;
    }//
    let s_to = post.s_to;
    if(s_to == ''){
        s_to = 0;
    }//
    let s_awards = post.s_awards;

    let e_schoolName = post.e_schoolName;
    let e_from = post.e_from;
    if(e_from == ''){
        e_from = 0;
    }//
    let e_to = post.e_to;
    if(e_to == ''){
        e_to = 0;
    }//
    let e_awards = post.e_awards;

    let o_schoolName = post.o_schoolName;
    let o_from = post.o_from;
    if(o_from == ''){
        o_from = 0;
    }//
    let o_to = post.o_to;
    if(o_to == ''){
        o_to = 0;
    }//
    let o_awards = post.o_awards;

    let specialSkills = post.specialSkills;

    //WORK EXPERIENCE
    let workEmployer1 = post.workEmployer1;
    let workNumber1 = post.workNumber1;
    if(e_from == ''){
        e_from = 0;
    }//
    let workFrom1 = post.workFrom1;
    if(workFrom1 == ''){
        workFrom1 = 0;
    }//
    let workTo1 = post.workTo1;
    if(workTo1 == ''){
        workTo1 = 0;
    }//
    let workPosition1 = post.workPosition1;
    let workReasonForLeaving1 =  post.workReasonForLeaving1;

    let workEmployer2 = post.workEmployer2;
    let workNumber2 = post.workNumber2;
    if(workNumber2 == ''){
        workNumber2 = 0;
    }//
    let workFrom2 = post.workFrom2;
    if(workFrom2 == ''){
        workFrom2 = 0;
    }//
    let workTo2 = post.workTo2;
    if(workTo2 == ''){
        workTo2 = 0;
    }//
    let workPosition2 = post.workPosition2;
    let workReasonForLeaving2 =  post.workReasonForLeaving2;

    let workEmployer3 = post.workEmployer3;
    let workNumber3 = post.workNumber3;
    if(workNumber3 == ''){
        workNumber3 = 0;
    }//
    let workFrom3 = post.workFrom3;
    if(workFrom3 == ''){
        workFrom3 = 0;
    }//
    let workTo3 = post.workTo3;
    if(workTo3 == ''){
        workTo3 = 0;
    }//
    let workPosition3 = post.workPosition3;
    let workReasonForLeaving3 =  post.workReasonForLeaving3;

    //LICENSES
    let licenseNumber1 = post.licenseNumber1;
    if(licenseNumber1 == ''){
        licenseNumber1 = 0;
    }//
    let licenseExpiry1 = post.licenseExpiry1;
    let licenseRating1 = post.licenseRating1;
    let licenseRemarks1 = post.licenseRemarks1;
    let licenseType1 = post.licenseType1;
    let licenseRestrictions1 = post.restriction1;
    let licenseRestrictionStringed1 = JSON.stringify(licenseRestrictions1);

    let driverstatus = post.driverstatus;
    let driver_status = JSON.stringify(driverstatus);

    //FAMILY BACKGROUND
    let father_name = post.father_name;
    let father_companyNumber = post.father_companyNumber;
    let father_birthdate = post.father_birthdate;
    if(father_birthdate == ''){
        father_birthdate = '1111-01-01';
    }//
    let father_occupation = post.father_occupation;

    let mother_name = post.mother_name;
    let mother_companyNumber = post.mother_companyNumber;
    let mother_birthdate = post.mother_birthdate;
    if(mother_birthdate == ''){
        mother_birthdate = '1111-01-01';
    }//
    let mother_occupation = post.mother_occupation;

    let sibling_name1 = post.sibling_name1;
    let sibling_companyNumber1 = post.sibling_companyNumber1;
    let sibling_birthdate1 = post.sibling_birthdate1;
    if(sibling_birthdate1 == ''){
        sibling_birthdate1 = '1111-01-01';
    }//
    let sibling_occupation1 = post.sibling_occupation1;

    let sibling_name2 = post.sibling_name2;
    let sibling_companyNumber2 = post.sibling_companyNumber2;
    let sibling_birthdate2 = post.sibling_birthdate2;
    if(sibling_birthdate2 == ''){
        sibling_birthdate2 = '1111-01-01';
    }//
    let sibling_occupation2 = post.sibling_occupation2;

    let children_name1 = post.children_name1;
    let children_birthdate1 = post.children_birthdate1;
    if(children_birthdate1 == ''){
        children_birthdate1 = '1111-01-01';
    }//
    let children_name2 = post.children_name2;
    let children_birthdate2 = post.children_birthdate2;
    if(children_birthdate2 == ''){
        children_birthdate2 = '1111-01-01';
    }//

    let personcrt_name1 = post.personcrt_name1;
    let personcrt_relationship1 = post.personcrt_relationship1;
    let personcrt_name2 = post.personcrt_name2;
    let personcrt_relationship2 = post.personcrt_relationship2;

    //ATTACHMENTS
    let sss_number = post.sss_number;
    if(sss_number == ''){
        sss_number = 0;
    }//

    let pagibig_number = post.pagibig_number;
    if(pagibig_number == ''){
        pagibig_number = 0;
    }//

    let tin_number = post.tin_number;
    if(tin_number == ''){
        tin_number = 0;
    }//

    let philhealth_number = post.philhealth_number;
    if(philhealth_number == ''){
        philhealth_number = 0;
    }//

    let facebook = post.facebook;
    let viber = post.viber;

    //DATE OF APPLICATION
    var date_joined = new Date();
    var dd = date_joined.getDate();
    var mm = date_joined.getMonth()+1;
    var yyyy = date_joined.getFullYear();
    if(dd < 10){
    dd = '0' + dd
    } 
    if(mm < 10){
    mm = '0' + mm
    } 
    date_joined = yyyy + '-' + mm + '-' + dd;
    console.log(date_joined)

    let appid = req.params.id;

    //IF THERE ARE NO CHANGES WITH THE FILES
    if(!req.files){
        gdb.query("UPDATE driver_personaldata SET firstName=?, middleName=?, lastName=?, nickname=?, sex=?, homeAddress=?, birthdate=?, location=?, personalNumber=?, emailAddress=?, contactPerson_Name=?, contactPerson_Number=?, contactPerson_Relationship=?, bloodType=?, religion=?, civilStatus=?, height=?, weight=?, driver_status=? WHERE driverID=?", [firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location, 
            personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, appid], (err, result) => {
            if(err) {
                console.log("error on personal data")
                console.log(err)
            }
            else if(!err){
                /* console.log("Updated: " + firstName + " DRIVER ID: " + appid);
                res.redirect('/hr/managedrivers'); */
                
                gdb.query("UPDATE driver_educationalbg SET m_schoolName=?, m_from=?, m_to=?, m_awards=?, c_schoolName=?, c_from=?, c_to=?, c_awards=?, s_schoolName=?, s_from=?, s_to=?, s_awards=?, e_schoolName=?, e_from=?, e_to=?, e_awards=?, o_schoolName=?, o_from=?, o_to=?, o_awards=?, specialSkills=? WHERE educationalbg_ID=?", [m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, 
                c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills, appid], (err, result) => {
                    if(err) {
                    console.log(err)
                    console.log("error on educational bg")
                    }
                    else if(!err){
                        gdb.query("UPDATE driver_workexperience SET workEmployer1=?, workNumber1=?, workFrom1=?, workTo1=?, workPosition1=?, workReasonForLeaving1=?, workEmployer2=?, workNumber2=?, workFrom2=?, workTo2=?, workPosition2=?, workReasonForLeaving2=?, workEmployer3=?, workNumber3=?, workFrom3=?, workTo3=?, workPosition3=?, workReasonForLeaving3=? WHERE workexperience_ID=?", [workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, 
                        workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3, appid], (err, result) => {
                        if(err) {
                            console.log(err)
                            console.log("error on work bg")
                        }
                        else if(!err){
                            gdb.query("UPDATE driver_licenses SET licenseNumber1=?, licenseExpiry1=?, licenseRating1=?, licenseRemarks1=?, licenseType1=?, licenseRestrictions1=? WHERE license_ID=?", [licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictionStringed1, appid], (err, result) => {
                            if(err) {
                                console.log(err)
                                console.log("error on license")
                            }
                            else if(!err){
                                gdb.query("UPDATE driver_familybg SET father_name=?, father_companyNumber=?, father_birthdate=?, father_occupation=?, mother_name=?, mother_companyNumber=?, mother_birthdate=?, mother_occupation=?, sibling_name1=?, sibling_companyNumber1=?, sibling_birthdate1=?, sibling_occupation1=?, sibling_name2=?, sibling_companyNumber2=?, sibling_birthdate2=?, sibling_occupation2=?, children_name1=?, children_birthdate1=?, children_name2=?, children_birthdate2=?, personcrt_name1=?, personcrt_relationship1=?, personcrt_name2=?, personcrt_relationship2=? WHERE familybg_ID=?", [father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2, appid], (err, result) => {
                                if(err) {
                                    console.log(err)
                                    console.log("error on family bg")
                                }
                                else if(!err){
                                    gdb.query("UPDATE driver_documents SET sss_number=?, pagibig_number=?, tin_number=?, philhealth_number=?, facebook=?, viber=? WHERE documents_ID=?", [sss_number, pagibig_number, tin_number, philhealth_number, facebook, viber, appid], (err, result) => {
                                        if(err) {
                                        console.log(err)
                                        console.log("error on documents")
                                        }
                                        else if(!err){
                                        console.log("Updated: " + firstName + " DRIVER ID: " + appid);
                                        res.redirect('/hr/managedrivers');
                                        }
                                    });
                                }
                                });
                            }
                            });
                        }
                        });
                    }
                });
            }
        });
    } 
    else{
        //QUERY FOR UPDATING WITH FILES
        gdb.query("SELECT * FROM driver_licenses WHERE license_ID=?", [appid], (err, licenseExisting) =>{
            if(err) console.log(err)
            else{
                gdb.query("SELECT * FROM driver_documents WHERE documents_ID=?", [appid], (err, documentsExisting) =>{
                    if(err) console.log(err)
                    else{
    
                    //QUERY FOR UPDATING WITH FILES
                    let license_file1 = "";
                    if(!req.files.license_file1) {
                        license_file1 = licenseExisting[0].license_file1;
                    }
                    else {
                        raw_license_file1 = req.files.license_file1.data;
                        let buff_raw_license_file1 = new Buffer.from(raw_license_file1);
                        license_file1 = buff_raw_license_file1.toString('base64');
                        console.log('driver license 1 file uploaded');
                    }
            
                    let profile_photo ="";
                    if(!req.files.profile_photo) {
                        profile_photo = documentsExisting[0].profile_photo;
                    }
                    else {        
                        raw_profile_photo = req.files.profile_photo.data;
                        let buff_raw_profile_photo = new Buffer.from(raw_profile_photo);
                        profile_photo = buff_raw_profile_photo.toString('base64');
                        console.log('profile photo uploaded');
                    }
            
                    let sss_file = "";
                    if(!req.files.sss_file) {
                        sss_file = documentsExisting[0].sss_file;
                    }
                    else {
                        raw_sss_file = req.files.sss_file.data;
                        let buff_raw_sss_file = new Buffer.from(raw_sss_file);
                        sss_file = buff_raw_sss_file.toString('base64');
                        console.log('profile photo uploaded');
                    }
            
                    let pagibig_file = "";
                    if(!req.files.pagibig_file) {
                        pagibig_file = documentsExisting[0].pagibig_file;
                    }
                    else {
                        raw_pagibig_file = req.files.pagibig_file.data;
                        let buff_raw_pagibig_file = new Buffer.from(raw_pagibig_file);
                        pagibig_file = buff_raw_pagibig_file.toString('base64');
                        console.log('pagibig file uploaded');
                    }
            
                    let tin_file = "";
                    if(!req.files.tin_file) {
                        tin_file = documentsExisting[0].tin_file;
                    }
                    else {
                        raw_tin_file = req.files.tin_file.data;
                        let buff_raw_tin_file = new Buffer.from(raw_tin_file);
                        tin_file = buff_raw_tin_file.toString('base64');
                        console.log('tin file uploaded');
                    }
            
                    let philhealth_file = "";
                    if(!req.files.philhealth_file) {
                        philhealth_file = documentsExisting[0].philhealth_file;
                    }
                    else {
                        raw_philhealth_file = req.files.philhealth_file.data;
                        let buff_raw_philhealth_file = new Buffer.from(raw_philhealth_file);
                        philhealth_file = buff_raw_philhealth_file.toString('base64');
                        console.log('philhealth file uploaded');
                    }
            
                    let mdr_file = "";
                    if(!req.files.mdr_file) {
                        mdr_file = documentsExisting[0].mdr_file;
                    }
                    else {
                        raw_mdr_file = req.files.mdr_file.data;
                        let buff_raw_mdr_file = new Buffer.from(raw_mdr_file);
                        mdr_file = buff_raw_mdr_file.toString('base64');
                        console.log('mdr file uploaded');
                    }
            
                    let nbi_file = "";
                    if(!req.files.nbi_file) {
                        nbi_file = documentsExisting[0].nbi_file;
                    }
                    else {
                        raw_nbi_file = req.files.nbi_file.data;
                        let buff_raw_nbi_file = new Buffer.from(raw_nbi_file);
                        nbi_file = buff_raw_nbi_file.toString('base64');
                        console.log('nbi file uploaded');
                    }
            
                    let brgyclearance_file = ""; 
                    if(!req.files.brgyclearance_file) {
                        brgyclearance_file = documentsExisting[0].brgyclearance_file;
                    }
                    else {
                        raw_brgyclearance_file = req.files.brgyclearance_file.data;
                        let buff_raw_brgyclearance_file = new Buffer.from(raw_brgyclearance_file);
                        brgyclearance_file = buff_raw_brgyclearance_file.toString('base64');
                        console.log('brgy clearance file uploaded');
                    }
            
                    //UPDATE QUERIES
                    gdb.query("UPDATE driver_personaldata SET firstName=?, middleName=?, lastName=?, nickname=?, sex=?, homeAddress=?, birthdate=?, location=?, personalNumber=?, emailAddress=?, contactPerson_Name=?, contactPerson_Number=?, contactPerson_Relationship=?, bloodType=?, religion=?, civilStatus=?, height=?, weight=?, driver_status=? WHERE driverID=?", [firstName, middleName, lastName, nickname, sex, homeAddress, birthdate, location,
                        personalNumber, emailAddress, contactPerson_Name, contactPerson_Number, contactPerson_Relationship, bloodType, religion, civilStatus, height, weight, driver_status, appid], (err, result) => {
                        if(err) {
                            console.log("error in personaldata")
                            console.log(err)
                        }
                        else if(!err){
                            gdb.query("UPDATE driver_educationalbg SET m_schoolName=?, m_from=?, m_to=?, m_awards=?, c_schoolName=?, c_from=?, c_to=?, c_awards=?, s_schoolName=?, s_from=?, s_to=?, s_awards=?, e_schoolName=?, e_from=?, e_to=?, e_awards=?, o_schoolName=?, o_from=?, o_to=?, o_awards=?, specialSkills=? WHERE educationalbg_ID=?", [m_schoolName, m_from, m_to, m_awards, c_schoolName, c_from, c_to, 
                            c_awards, s_schoolName, s_from, s_to, s_awards, e_schoolName, e_from, e_to, e_awards, o_schoolName, o_from, o_to, o_awards, specialSkills, appid], (err, result) => {
                                if(err) {
                                    console.log("error in educationalbg")
                                    console.log(err)
                                }
                                else if(!err){
                                gdb.query("UPDATE driver_workexperience SET workEmployer1=?, workNumber1=?, workFrom1=?, workTo1=?, workPosition1=?, workReasonForLeaving1=?, workEmployer2=?, workNumber2=?, workFrom2=?, workTo2=?, workPosition2=?, workReasonForLeaving2=?, workEmployer3=?, workNumber3=?, workFrom3=?, workTo3=?, workPosition3=?, workReasonForLeaving3=? WHERE workexperience_ID=?", [workEmployer1, workNumber1, workFrom1, workTo1, workPosition1, workReasonForLeaving1, workEmployer2, 
                                    workNumber2, workFrom2, workTo2, workPosition2, workReasonForLeaving2, workEmployer3, workNumber3, workFrom3, workTo3, workPosition3, workReasonForLeaving3, appid], (err, result) => {
                                    if(err) {
                                        console.log("error in workexperience")
                                        console.log(err)
                                    }
                                    else if(!err){
                                        gdb.query("UPDATE driver_licenses SET licenseNumber1=?, licenseExpiry1=?, licenseRating1=?, licenseRemarks1=?, licenseType1=?, licenseRestrictions1=?, license_file1=? WHERE license_ID=?", [licenseNumber1, licenseExpiry1, licenseRating1, licenseRemarks1, licenseType1, licenseRestrictionStringed1, license_file1, appid], (err, result) => {
                                        if(err) {
                                            console.log("error in licenses")
                                            console.log(err)
                                        }
                                        else if(!err){
                                            gdb.query("UPDATE driver_familybg SET father_name=?, father_companyNumber=?, father_birthdate=?, father_occupation=?, mother_name=?, mother_companyNumber=?, mother_birthdate=?, mother_occupation=?, sibling_name1=?, sibling_companyNumber1=?, sibling_birthdate1=?, sibling_occupation1=?, sibling_name2=?, sibling_companyNumber2=?, sibling_birthdate2=?, sibling_occupation2=?, children_name1=?, children_birthdate1=?, children_name2=?, children_birthdate2=?, personcrt_name1=?, personcrt_relationship1=?, personcrt_name2=?, personcrt_relationship2=? WHERE familybg_ID=?", [father_name, father_companyNumber, father_birthdate, father_occupation, mother_name, mother_companyNumber, mother_birthdate, mother_occupation, sibling_name1, sibling_companyNumber1, sibling_birthdate1, sibling_occupation1, sibling_name2, sibling_companyNumber2, sibling_birthdate2, sibling_occupation2, children_name1, children_birthdate1, children_name2, children_birthdate2, personcrt_name1, personcrt_relationship1, personcrt_name2, personcrt_relationship2, appid], (err, result) => {
                                            if(err) {
                                                console.log("error in familybg")
                                                console.log(err)
                                            }
                                            else if(!err){            
                                                gdb.query("UPDATE driver_documents SET profile_photo=?, sss_number=?, sss_file=?, pagibig_number=?, pagibig_file=?, tin_number=?, tin_file=?, philhealth_number=?, philhealth_file=?, mdr_file=?, nbi_file=?, brgyclearance_file=?, facebook=?, viber=? WHERE documents_ID=?", [profile_photo, sss_number, sss_file, pagibig_number, pagibig_file, tin_number, tin_file, philhealth_number,philhealth_file, mdr_file, nbi_file, brgyclearance_file, facebook, viber, appid], (err, result) => {
                                                    if(err) {
                                                        console.log("error in documents")
                                                        console.log(err)
                                                    }
                                                    else if(!err){
                                                        console.log("UPDATED: " + firstName + " DRIVER ID: " + appid);
                                                        res.redirect('/hr/managedrivers');
                                                    }
                                                });
                                            }
                                            });
                                        }
                                        });
                                    }
                                    });
                                }
                            });
                        }
                        }); 
                    }
                })
            }
        })
    }
}

//DELETE DRIVER DETAILS
exports.hr_deletedriverdetails = function(req, res){
    let driverID = req.params.id;
    gdb.query("DELETE FROM driver_personaldata WHERE driverID=?", [driverID], (err, result) =>{
        if(err) console.log(err)
        else{
            console.log("Driver " + driverID +" deleted!");
            res.redirect("/hr/managedrivers");
        }
    })
}
//END OF HR PARTS

//ERROR! PAGE NOT FOUND
exports.errorpage = function(req, res){
    message = "This page doesn't exists!";
    res.render('errorpage', {message: message});
}