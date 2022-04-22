import jwt from 'jsonwebtoken'
import config from '../config'
import User from '../models/User.model'

export async function fetchUser(req, res, next) {
  let token
  if (req.headers.authorization) {
    token = req.headers.authorization
  } else if (req.query && req.query.token) {
    token = req.query.token
  }

  // skip the next if token is undefined
  if (token) {
    try {
      const payload = jwt.verify(token, config.APP_SECRET)

      req.user = await User.findByPk(payload.id)
    } catch (err) {
      res.status(401).send({ error: err.message })
    }
  }

  next()
}

export const authenticate = (roles = []) => (req, res, next) => {
  if (!req.user) {
    res.status(401).send('Authorization required')
  } else if (roles.length && roles.indexOf(req.user.role) < 0) {
    res.status(403).send('Permission denied')
  } else {
    next()
  }
}
