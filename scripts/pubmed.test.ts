import { describe, test, expect } from 'vitest'
import { parsePmidsFromESearch } from './pubmed'

describe('parsePmidsFromESearch', () => {
  test('esearch XML에서 PMID 목록 추출', () => {
    const xml = `<eSearchResult><IdList><Id>11302416</Id><Id>10838651</Id></IdList></eSearchResult>`
    expect(parsePmidsFromESearch(xml)).toEqual(['11302416', '10838651'])
  })

  test('결과 없으면 빈 배열', () => {
    const xml = `<eSearchResult><IdList></IdList></eSearchResult>`
    expect(parsePmidsFromESearch(xml)).toEqual([])
  })
})
