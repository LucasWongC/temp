import { check } from 'express-validator'

export const getIdValidator = (
  Model,
  idField = 'id',
  dbField = 'id',
  variableName = ''
) =>
  check(idField)
    .exists()
    .custom((id, { req }) =>
      Model.findOne({
        where: { [dbField]: id },
      }).then(instance => {
        if (!instance) {
          return Promise.reject(`${Model.name} not found`)
        } else {
          const instanceName =
            variableName ||
            Model.name.charAt(0).toLowerCase() + Model.name.slice(1)
          req[instanceName] = instance
        }
      })
    )
