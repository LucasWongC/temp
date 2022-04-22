import { body as bodyCheck } from 'express-validator'

import { validator } from '../helpers/decorators'
import User, { UserRoles } from '../models/User.model'
import SMSContact from '../models/SMSContact.model'

export default class ProfileController {
  static async info(req, res) {
    const user = await User.findByPk(req.user.id)
    let messageCount = 0
    if (user.role === UserRoles.ADMIN) {
      messageCount = await SMSContact.sum('unreadCount')
    } else {
      messageCount = await SMSContact.sum('unreadCount', {
        where: { UserId: user.id },
      })
    }

    res.json({
      ...user.toJSON(),
      messageCount,
    })
  }

  static async getMessageCount(req, res) {
    const user = await User.findByPk(req.user.id)
    let messageCount = 0
    if (user.role === UserRoles.ADMIN) {
      messageCount = await SMSContact.sum('unreadCount')
    } else {
      messageCount = await SMSContact.sum('unreadCount', {
        where: { UserId: user.id },
      })
    }

    res.json(messageCount)
  }

  /*
  update the profile
  */
  @validator([
    bodyCheck('firstName').exists(),
    bodyCheck('lastName').exists(),
    bodyCheck('email')
      .exists()
      .isEmail(),
  ])
  static async update(req, res) {
    const { body } = req

    const user = await User.findByPk(req.user.id)
    const emailUser = await User.findByEmail(body.email)

    if (emailUser && emailUser.id !== user.id) {
      // check if email is duplicated
      res.status(503).send({ error: 'Email duplicates' })
    } else {
      // update the user
      await user.update(body)
      res.send(user)
    }
  }
}
