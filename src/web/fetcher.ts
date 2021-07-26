export default body => fetch('/api', {
  method: "POST",
  body,
  headers: {
    'Content-Type': 'application/json'
  }
}).then(r => r.json());