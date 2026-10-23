/**
 * Finding a port nobody is using.
 *
 * This is separated from the rest of the development runner because it is the
 * part that is easy to get subtly wrong, and because it can be tested without
 * starting an application.
 */
import { connect } from 'node:net';

/**
 * Whether nothing is listening on one address.
 *
 * A connection that is refused means nothing is there. A connection that is
 * answered means something is. A timeout means something is there but not
 * answering — a firewall, most likely — and it is given the benefit of the
 * doubt and left alone.
 */
export function answered(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });

    let settled = false;
    const settle = (free) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(free);
    };

    socket.setTimeout(500);

    // Something answered, so the port is in use.
    socket.once('connect', () => settle(false));

    // Nothing refused the connection, so nothing is listening.
    socket.once('error', (error) => settle(error.code === 'ECONNREFUSED'));

    socket.once('timeout', () => settle(false));
  });
}

/**
 * Whether anything is listening on a port.
 *
 * The port is not *opened* to find out. Windows lets two sockets bind to the
 * same port when both ask for address reuse, so a bind succeeds even when the
 * port is taken — and then the dev server and whatever else is holding it are
 * both listening, and which one a connection reaches is not something to leave
 * to chance.
 *
 * So the port is *asked* instead. A connection that is answered means
 * something is there.
 *
 * Both loopback addresses are asked. A server on `::1` and a server on
 * `127.0.0.1` are different sockets that happen to share a port number, and
 * only one of them is the one a connection would reach. A dev server left
 * running by an earlier session is usually on one of them and not the other.
 */
export function isFree(port) {
  return Promise.all([answered('127.0.0.1', port), answered('::1', port)]).then(
    ([ipv4, ipv6]) => ipv4 && ipv6,
  );
}

/**
 * The first free port at or after `first`.
 *
 * There is a window between the check and the dev server taking the port, and
 * it is the same window every tool that picks a port has. The dev server is
 * told to hold the port it is given, so a port lost in that window is a loud
 * failure rather than a silent drift.
 */
export async function findPort(first, attempts) {
  for (let port = first; port < first + attempts; port += 1) {
    if (await isFree(port)) {
      return port;
    }
  }

  throw new Error(
    `no free port between ${first} and ${first + attempts - 1}; ` +
      'something else is holding the whole range',
  );
}
