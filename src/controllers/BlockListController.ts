import { body as bodyCheck } from 'express-validator'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import BlockList, { BlockType } from '../models/BlockList.model'

const idValidator = getIdValidator(BlockList)

export default class BlockListController {
  static async index(req, res) {
    const rows = await BlockList.findAll()

    res.json(rows)
  }

  @validator([
    bodyCheck('type')
      .exists()
      .isIn(Object.values(BlockType)),
    bodyCheck('content')
      .exists()
      .isString(),
  ])
  static async create(req, res) {
    const { body } = req
    const contents = body.content.split(/\r?\n/)

    const rows = []
    for (const item of contents) {
      if (!item.trim()) {
        continue
      }

      const blockList = await BlockList.create({
        type: body.type,
        content: item.trim(),
      })
      rows.push(blockList)
    }

    res.json(rows)
  }

  /*
  get the block list
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.blockList)
  }

  /*
  update the block list
  */
  @validator([idValidator])
  static async update(req, res) {
    const { blockList, body } = req

    await blockList.update(body)

    res.json(blockList)
  }

  /*
  delete the block list
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { blockList } = req

    await blockList.destroy()
    res.json('success')
  }
}
