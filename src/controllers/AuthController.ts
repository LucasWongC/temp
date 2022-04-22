import jwt from 'jsonwebtoken'
import { body as bodyCheck } from 'express-validator'

import config from '../config'
import { validator } from '../helpers/decorators'
import User from '../models/User.model'

export default class AuthController {
  @validator([
    bodyCheck('email')
      .exists()
      .isEmail(),
    bodyCheck('password').exists(),
  ])
  static async login(req, res) {
    const { email, password } = req.body
    const user = await User.findOne({
      where: { email },
    })

    if (!user || !user.validPassword(password)) {
      return res.status(401).json({ token: null })
    }

    // generate token
    const token = jwt.sign(user.toJSON(), config.APP_SECRET, {
      expiresIn: config.JWT_EXPIRE,
    })

    res.json({ token })
  }

  /*
  sends the forgot password email to the user
  */
  @validator([
    bodyCheck('email')
      .exists()
      .isEmail(),
  ])
  static async forgotPassword(req, res) {
    const { email } = req.body
    const user = await User.findOne({
      where: { email },
    })
    if (!user) {
      res.status(400).send('Email not found')
    }

    res.json('Reset email was sent successfully')
  }

  @validator([bodyCheck('token').exists()])
  static async checkToken(req, res) {
    const { token } = req.body
    const user = await User.findOne({
      where: { reset_token: token },
    })
    if (!user) {
      res.status(422).send('Token is invalid')
    }

    res.json('valid')
  }

  @validator([
    bodyCheck('reset_token').exists(),
    bodyCheck('password')
      .exists()
      .isLength({ min: 8 }),
  ])
  static async resetPassword(req, res) {
    const { reset_token, password } = req.body
    const user = await User.findOne({
      where: { reset_token },
    })
    if (!user) {
      res.status(422).send('Token is invalid')
    }

    user.password = password
    user.reset_token = null
    user.verified = true
    await user.save()

    // generate token
    const token = jwt.sign(user.toJSON(), config.APP_SECRET, {
      expiresIn: config.JWT_EXPIRE,
    })

    res.json({ token })
  }
}
