export function findRouteHandlers(app, method, routePath) {
  const lower = method.toLowerCase();
  const stack = app?.router?.stack || app?._router?.stack || [];
  const handlers = findInStack(stack, lower, routePath);
  if (handlers) {
    return handlers;
  }
  throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
}

function findInStack(stack, method, routePath) {
  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      if (!layer.route.methods?.[method]) continue;
      for (const path of paths) {
        if (matchesPath(path, routePath)) {
          return layer.route.stack
            .filter(entry => !entry.method || entry.method === method)
            .map(entry => entry.handle);
        }
      }
    } else if (layer.handle && layer.handle.stack) {
      const nested = findInStack(layer.handle.stack, method, routePath);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function matchesPath(routePath, requestedPath) {
  if (Array.isArray(routePath)) {
    return routePath.some(entry => matchesPath(entry, requestedPath));
  }
  if (routePath instanceof RegExp) {
    return routePath.test(requestedPath);
  }
  if (typeof routePath !== 'string' || typeof requestedPath !== 'string') {
    return false;
  }
  if (routePath === requestedPath) return true;
  // Basic support for parameterised routes like /api/tickets/:id
  const routeParts = routePath.split('/');
  const requestParts = requestedPath.split('/');
  if (routeParts.length !== requestParts.length) return false;
  return routeParts.every((part, index) => part.startsWith(':') || part === requestParts[index]);
}

export function createRequest({ method, path, params = {}, body = {}, query = {} }, app) {
  return {
    method,
    url: path,
    originalUrl: path,
    path,
    params,
    body,
    query,
    headers: {},
    get(header) {
      return this.headers[header.toLowerCase()];
    },
    header(header) {
      return this.get(header);
    },
    app
  };
}

export function createResponse(resolve, reject) {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    locals: {},
    set(field, value) {
      this.headers[field.toLowerCase()] = value;
      return this;
    },
    get(field) {
      return this.headers[field.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      finish();
      return this;
    },
    send(payload) {
      this.body = payload;
      finish();
      return this;
    },
    end(payload) {
      if (payload !== undefined) {
        this.body = payload;
      }
      finish();
      return this;
    }
  };

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    resolve({ statusCode: res.statusCode, headers: res.headers, body: res.body });
  }

  res.finish = finish;
  res.finished = () => finished;
  res.writeHead = function (statusCode, headers = {}) {
    this.statusCode = statusCode;
    Object.entries(headers).forEach(([key, value]) => this.set(key, value));
    return this;
  };

  res.error = err => {
    if (finished) return;
    finished = true;
    reject(err);
  };

  return res;
}

export function invokeRoute(app, { method, path, params = {}, body = {}, query = {} }) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const handlers = findRouteHandlers(app, method, path);
    const req = createRequest({ method, path, params, body, query }, app);
    const res = createResponse(result => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    }, err => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    const dispatch = index => {
      if (index >= handlers.length) {
        if (!resolved) {
          resolved = true;
          resolve({ statusCode: res.statusCode, headers: res.headers, body: res.body });
        }
        return;
      }
      const handler = handlers[index];
      let nextCalled = false;
      const next = err => {
        if (nextCalled) return;
        nextCalled = true;
        if (err) {
          res.error(err);
        } else {
          dispatch(index + 1);
        }
      };

      try {
        const outcome = handler(req, res, next);
        if (isPromise(outcome)) {
          outcome.then(() => {
            if (!res.finished() && !nextCalled) {
              dispatch(index + 1);
            }
          }).catch(err => res.error(err));
        } else if (handler.length < 3 && !res.finished() && !nextCalled) {
          dispatch(index + 1);
        }
      } catch (error) {
        res.error(error);
      }
    };

    dispatch(0);
  });
}

function isPromise(value) {
  return value && typeof value.then === 'function';
}
