import { body as bodyCheck } from 'express-validator'
import sequelize from 'sequelize'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import TransferOption from '../models/TransferOption.model'
import Campaign from '../models/Campaign.model'

const idValidator = getIdValidator(TransferOption)

export default class TransferOptionController {
  /*
  get the options
  */
  static async index(req, res) {
    const replacements = {
      CampaignId: req.query.CampaignId || 0,
    }

    const sql = `
      SELECT TransferOptions.*, COUNT(TransferNumbers.id) AS numbersCount
      FROM TransferOptions
      LEFT JOIN TransferNumbers ON TransferNumbers.TransferOptionId = TransferOptions.id
      WHERE CampaignId = :CampaignId
      GROUP BY TransferOptions.id
    `

    const rows = await TransferOption.sequelize.query(sql, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    })

    res.json(rows)
  }

  /*
  create the option
  */
  @validator([
    bodyCheck('name').exists(),
    getIdValidator(Campaign, 'CampaignId'),
  ])
  static async create(req, res) {
    const { body } = req

    const option = await TransferOption.create(body)
    res.json(option)
  }

  /*
  get the option
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.transferOption)
  }

  /*
  update the option
  */
  @validator([idValidator, bodyCheck('name').exists()])
  static async update(req, res) {
    const { transferOption, body } = req

    await transferOption.update(body)

    res.json(transferOption)
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { transferOption } = req

    await transferOption.destroy()
    res.json('success')
  }
}
