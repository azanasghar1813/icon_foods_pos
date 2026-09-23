async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/v1/print/kitchen/af42ab08-5dee-4310-a727-5972d1990950', {
      method: 'POST'
    });
    const data = await res.json();
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
