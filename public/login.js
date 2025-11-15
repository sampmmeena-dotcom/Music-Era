document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.querySelector('#email').value;
  const password = document.querySelector('#password').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (res.ok) {
    const data = await res.json();
    localStorage.setItem('token', data.token);
    window.location.href = `/playlist.html?token=${data.token}`;
  } else {
    const error = await res.json();
    alert(error.error);
  }
});