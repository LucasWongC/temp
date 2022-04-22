import { Op } from 'sequelize'
import { body as bodyCheck } from 'express-validator'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import IVRPrompt, { PromptTypes } from '../models/IVRPrompt.model'
import IVR from '../models/IVR.model'
import TransferOption from '../models/TransferOption.model'
import IVRPromptMessage from '../models/IVRPromptMessage.model'

const idValidator = getIdValidator(IVRPrompt)

export default class IVRPromptController {
  /*
  get the IVRPrompts
  */
  static async index(req, res) {
    const rows = await IVRPrompt.findAll({
      where: { IVRId: req.query.IVRId || 0 },
      include: [
        IVRPromptMessage,
        {
          attributes: ['id', 'name'],
          model: TransferOption,
        },
      ],
    })

    res.json(rows)
  }

  /*
  create the IVRPrompt
  */
  @validator([
    bodyCheck('type').exists(),
    bodyCheck('messages').custom((messages, { req }) => {
      if (
        (req.type === PromptTypes.PROMPT ||
          req.type === PromptTypes.END_CALL) &&
        (!messages || !messages.length)
      ) {
        throw new Error('Messages is required')
      }
      return true
    }),
    bodyCheck('buttons')
      .optional()
      .isArray(),
    getIdValidator(IVR, 'IVRId'),
  ])
  static async create(req, res) {
    const { body } = req

    const ivrPrompt = await IVRPrompt.create(body)
    const transferOption = await TransferOption.findByPk(
      ivrPrompt.TransferOptionId
    )

    const messages = []
    if (
      (body.type === PromptTypes.PROMPT ||
        body.type === PromptTypes.END_CALL) &&
      body.messages
    ) {
      for (const item of body.messages) {
        const message = await IVRPromptMessage.create({
          ...item,
          IVRPromptId: ivrPrompt.id,
          IVRId: ivrPrompt.IVRId,
        })
        messages.push(message)
      }
    }

    // mark other as not first
    if (ivrPrompt.first) {
      await IVRPrompt.update(
        {
          first: false,
        },
        {
          where: {
            IVRId: ivrPrompt.IVRId,
            first: true,
          },
        }
      )
    }

    res.json({
      ...ivrPrompt.toJSON(),
      messages,
      transferName: transferOption ? transferOption.name : '',
    })
  }

  /*
  update the IVRPrompt
  */
  @validator([
    idValidator,
    bodyCheck('buttons')
      .optional()
      .isArray(),
  ])
  static async update(req, res) {
    const { iVRPrompt, body } = req

    // prevent update message, audio
    body.message = undefined
    body.audio = undefined

    await iVRPrompt.update(body)

    // mark other as not first
    if (body.first) {
      await IVRPrompt.update(
        {
          first: false,
        },
        {
          where: {
            IVRId: iVRPrompt.IVRId,
            id: { [Op.ne]: iVRPrompt.id },
            first: true,
          },
        }
      )
    }

    const json = iVRPrompt.toJSON()
    json.messages = []

    if (body.messages !== undefined) {
      if (
        (iVRPrompt.type === PromptTypes.PROMPT ||
          iVRPrompt.type === PromptTypes.END_CALL) &&
        body.messages
      ) {
        for (const item of body.messages) {
          if (item.id) {
            const message = await IVRPromptMessage.findByPk(item.id)
            await message.update(item)
            json.messages.push(message)
          } else {
            const message = await IVRPromptMessage.create({
              ...item,
              IVRPromptId: iVRPrompt.id,
              IVRId: iVRPrompt.IVRId,
            })
            json.messages.push(message)
          }
        }
      }

      // set messages
      await iVRPrompt.$set('messages', json.messages)

      // destroy unset messages
      await IVRPromptMessage.destroy({
        where: {
          IVRPromptId: { [Op.eq]: null },
        },
      })
    }

    json.TransferOption = await TransferOption.findByPk(
      iVRPrompt.TransferOptionId
    )

    res.json(json)
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { iVRPrompt } = req

    await iVRPrompt.destroy()
    res.json('success')
  }
}
