window.addEventListener('offline', () =>{

   alert("you are currently offline check your internet connection and try again") 
if(navigator.online){
    alert("you are online")}
    


});
window.addEventListener('copy', () =>{
    alert("you copied my content")
});
window.addEventListener('paste', () =>{
    alert("we restrict pasting on this site");
    const a =prompt("please enter your name");
    alert(a + " You have been restricted and permanently abound from using this sercice");
});
fetch('https://api.ipify.org?format=json')
  .then(response => response.json())
  .then(data => {
    const ipAddress = data.ip;
    // Process the IP address
  });
