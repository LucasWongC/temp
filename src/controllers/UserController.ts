import { Op } from 'sequelize'
import { body as bodyCheck } from 'express-validator'
import randtoken from 'rand-token'

import { validator } from '../helpers/decorators'
import { siteUrl } from '../helpers'
import { getIdValidator } from '../helpers/validators'
import { sendMail } from '../services/sendgrid'
import User, { UserRoles } from '../models/User.model'

const idValidator = getIdValidator(User)

export default class UserController {
  static async index(req, res) {
    const users = await User.findAll({
      where: {
        id: { [Op.gt]: 1 },
      },
    })

    res.json(users)
  }

  @validator([
    bodyCheck('email')
      .exists()
      .isEmail(),
    bodyCheck('id')
      .optional()
      .isInt(),
  ])
  static async emailExists(req, res) {
    const { body } = req
    const id = body.id || req.user.id
    const user = await User.findByEmail(body.email)
    if (!user || user.id == id) {
      res.json({ exists: false })
    } else {
      res.json({ exists: true })
    }
  }

  static async getAgents(req, res) {
    const agents = await User.findAll({
      where: {
        role: UserRoles.AGENT,
      },
    })

    res.json(agents)
  }

  @validator([
    bodyCheck('email')
      .exists()
      .isEmail(),
    bodyCheck('firstName').exists(),
    bodyCheck('lastName').exists(),
  ])
  static async create(req, res) {
    const { body } = req

    const duplicates = await User.findByEmail(body.email)
    if (duplicates) {
      res.status(422).json({ email: 'duplicates' })
      return
    }

    const password = randtoken.generate(10)
    const user = await User.create({
      ...body,
      password,
    })

    await sendMail(user.email, 'Agent Registered', 'newUser', {
      name: user.fullName,
      password,
      loginUrl: siteUrl('/login'),
    })

    res.json(user)
  }

  @validator([idValidator])
  static async update(req, res) {
    const { body, user } = req
    const allowFields = ['email', 'firstName', 'lastName']
    for (const field of allowFields) {
      if (body[field] !== undefined) {
        user[field] = body[field]
      }
    }

    if (user.changed('email')) {
      const duplicates = await User.findByEmail(body.email)
      if (duplicates) {
        res.status(422).json({ email: 'duplicates' })
        return
      }
    }

    await user.save()

    res.json(user)
  }

  @validator([idValidator])
  static async delete(req, res) {
    const { user } = req

    await user.destroy()

    res.json({ success: true })
  }
}
