import { Op } from 'sequelize'
import {
  Table,
  Column,
  DataType,
  Model,
  AfterCreate,
  BeforeDestroy,
} from 'sequelize-typescript'
import Lead from './Lead.model'

export enum BlockType {
  EMAIL = 'Email',
  PHONE = 'Phone',
}

@Table({
  timestamps: false,
})
class BlockList extends Model<BlockList> {
  @Column({
    type: DataType.ENUM('Email', 'Phone'),
    allowNull: false,
  })
  type: BlockType

  @Column({
    allowNull: false,
  })
  content: string

  @AfterCreate
  static async blockLeads(blockList: BlockList) {
    // block leads
    if (blockList.type === BlockType.EMAIL) {
      await Lead.update(
        {
          blocked: true,
        },
        {
          where: { email: blockList.content },
        }
      )
    } else if (blockList.type === BlockType.PHONE) {
      await Lead.update(
        {
          blocked: true,
        },
        {
          where: {
            phone: {
              [Op.endsWith]: blockList.content,
            },
          },
        }
      )
    }
  }

  @BeforeDestroy
  static async unblockLeads(blockList: BlockList) {
    if (blockList.type === BlockType.EMAIL) {
      await Lead.update(
        {
          blocked: false,
        },
        {
          where: { email: blockList.content },
        }
      )
    } else if (blockList.type === BlockType.PHONE) {
      await Lead.update(
        {
          blocked: false,
        },
        {
          where: {
            phone: {
              [Op.endsWith]: blockList.content,
            },
          },
        }
      )
    }
  }

  static async isBlocked(data) {
    const conditions = []
    if (data.email) {
      conditions.push({
        type: BlockType.EMAIL,
        content: data.email,
      })
    }
    if (data.phone) {
      conditions.push({
        type: BlockType.PHONE,
        content: { [Op.endsWith]: data.phone.replace('+', '') },
      })
    }

    const blocked = await BlockList.count({
      where: {
        [Op.or]: conditions,
      },
    })

    return blocked > 0
  }
}

export default BlockList
