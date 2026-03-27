const users = [
  {username:"admin", password:"admin123", role:"admin", redirect:"admin.html"},
  {username:"tafs", password:"tafs123", role:"tafs", redirect:"tafs.html"},
  {username:"acc", password:"acc123", role:"acc", redirect:"acc.html"}
];

function login(){

  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value.trim();
  const error = document.getElementById("error");

  const user = users.find(x=>x.username===u && x.password===p);

  if(user){
    localStorage.setItem("role", user.role);
    window.location.href = user.redirect;
  } else {
    error.style.display = "block";
  }
}

function checkAuth(role){
  const r = localStorage.getItem("role");
  if(!r) window.location.href="index.html";
  if(role && r!==role && r!=="admin"){
    alert("Tidak ada akses");
    window.location.href="index.html";
  }
}

function logout(){
  localStorage.clear();
  window.location.href="index.html";
}