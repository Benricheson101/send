export const REST_URL =
  window.location.protocol + '//' + window.location.host + '/api';

// export const REST_URL = 'http://192.168.246.53:8000/api';

export const createTicket = async () => {
  const ticket = await fetch(REST_URL + '/tickets', {
    method: 'POST',
  }).then(r => r.json());

  console.log(ticket);
  const code: string = ticket.code;
  return code;
};
