exports.hr_home = function(req, res){  

    //TODAY
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1;
    //var mm = today.getMonth()+9;
    var yyyy = today.getFullYear();
    if(dd < 10){
      dd = '0' + dd
    } 
    if(mm < 10){
      mm = '0' + mm
    } 
    today = yyyy + '-' + mm + '-' + dd;

    gdb.connect(function(err){
      if (err) throw err;
      var sql = 'SELECT * FROM employee WHERE user_ID=? AND account_type="HR"'
      gdb.query(sql,[req.session.passport.user], function(err,result){
          console.log(req.session.passport.user);
          console.log(result)
          if(err){
              throw err;
          }else{
              if(result[0] == null){
                  console.log("You cannot access an HR site due to being an Admin of the system")
                  res.redirect('/admin/home')
              }else{
                  var obj = result[0]
                   //UPCOMING BIRTHDAYS
                gdb.query("SELECT driverID, firstName, lastName, DATE_FORMAT(birthdate, '%m-%d')AS birthdate FROM driver_personaldata WHERE DATE_FORMAT(birthdate, CONCAT(YEAR(CURRENT_DATE),'-%m-%d')) BETWEEN DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AND DATE_FORMAT(ADDDATE(CURRENT_DATE, 30), '%Y-%m-%d') ORDER BY birthdate ASC", (err, birthdays) => {
                  if(err){
                      console.log(err)
                  }else{
                    //PREVIOUS BIRTHDAYS
                    //SELECT firstName, DATE_FORMAT(birthdate, '%m-%d')AS birthdate FROM driver_personaldata WHERE DAYOFYEAR(birthdate) BETWEEN DAYOFYEAR(CURRENT_DATE)-30 AND DAYOFYEAR(CURRENT_DATE) ORDER BY birthdate desc;
                    let upcomingBirthdays = birthdays.length;
                    gdb.query("SELECT *, DATE_FORMAT(birthdate, '%m-%d')AS birthdate FROM driver_personaldata WHERE DATE_FORMAT(birthdate, CONCAT(YEAR(CURRENT_DATE),'-%m-%d')) BETWEEN DATE_FORMAT(ADDDATE(CURRENT_DATE, -7), '%Y-%m-%d') AND DATE_FORMAT(ADDDATE(CURRENT_DATE, -1), '%Y-%m-%d') ORDER BY birthdate DESC", (err, previousbirthdays) => {
                      if(err) console.log(err)
                      else{
                        //DRIVER'S LICENSE EXPIRY
                        gdb.query("SELECT driverID, driver_personaldata.firstName, driver_licenses.licenseNumber1, DATE_FORMAT(driver_licenses.licenseExpiry1, '%Y-%m-%d')AS licenseExpiry1 FROM driver_personaldata INNER JOIN driver_licenses ON driver_personaldata.driverID = driver_licenses.license_ID WHERE licenseExpiry1 < DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') OR DAYOFYEAR(licenseExpiry1) BETWEEN DAYOFYEAR(CURRENT_DATE) AND DAYOFYEAR(CURRENT_DATE)+30 ORDER BY licenseExpiry1 ASC", 
                        (err, licenses) => {
                          if(err) console.log(err)
                          else{
                            let upcomingLicenseExpiry = licenses.length;
                            let expiredLicenses = 0;
                            for(i = 0; i < licenses.length; i++){
                              if(licenses[i].licenseExpiry1 <= today){
                                expiredLicenses++;
                              }
                            }
                            gdb.query("SELECT * FROM app_personaldata WHERE app_status = 'For Checking'", (err, forChecking) =>{
                              if(err) console.log(err)
                              else{
                                gdb.query("SELECT * FROM app_personaldata WHERE app_status = 'For Interview'", (err, forInterview) =>{
                                  if(err) console.log(err)
                                  else{                      
                                    gdb.query("SELECT * FROM driver_personaldata WHERE driver_status LIKE '%1%'", (err, regular) =>{
                                      if(err) console.log(err)
                                      else{
                                        gdb.query("SELECT * FROM driver_personaldata WHERE driver_status LIKE '%2%'", (err, oncall) =>{
                                          if(err) console.log(err)
                                          else{
                                            gdb.query("SELECT * FROM driver_personaldata WHERE driver_status LIKE '%3%'", (err, onleave) =>{
                                              if(err) console.log(err)
                                              else{
                                                gdb.query("SELECT * FROM driver_personaldata WHERE driver_status LIKE '%4%'", (err, suspended) =>{
                                                  if(err) console.log(err)
                                                  else{
                                                    gdb.query("SELECT * FROM driver_personaldata WHERE driver_status LIKE '%5%'", (err, terminated) =>{
                                                      if(err) console.log(err)
                                                      else{
                                                        gdb.query("SELECT * FROM driver_personaldata WHERE driver_status LIKE '%6%'", (err, resigned) =>{
                                                          if(err) console.log(err)
                                                          else{
                                                            gdb.query("SELECT * FROM driver_personaldata WHERE driver_status LIKE '%7%'", (err, onprobation) =>{
                                                              if(err) console.log(err)
                                                              else{
                                                                res.render('hr_home', {birthdays: birthdays, upcomingBirthdays: upcomingBirthdays, previousbirthday: previousbirthdays, licenses: licenses, upcomingLicenseExpiry:upcomingLicenseExpiry, 
                                                                  expiredLicenses: expiredLicenses, today: today, forChecking: forChecking.length, forInterview: forInterview.length, 
                                                                  regular: regular.length, oncall: oncall.length, onleave: onleave.length, suspended: suspended.length, terminated: terminated.length, resigned: resigned.length, onprobation: onprobation.length,user_name: obj.username});
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