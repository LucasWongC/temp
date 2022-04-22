import { replaceParams } from '../index'
import { expect } from 'chai'
import 'mocha'

describe('Replace Params', () => {
  it('test replace', () => {
    const result = replaceParams('Hi {firstName} {lastName}', {
      firstName: 'May',
      lastName: 'Lee',
    })
    expect(result).to.equal('Hi May Lee')
  })

  it('test 2 occurances', () => {
    const result = replaceParams('Hi {firstName} {firstName}', {
      firstName: 'May',
    })
    expect(result).to.equal('Hi May May')
  })
})
