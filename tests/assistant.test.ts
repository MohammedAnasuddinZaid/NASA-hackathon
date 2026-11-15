import { describe, expect, it } from 'vitest';
import { answerToText, ask } from '../src/lib/assistant';
import type { AssistantAnswer } from '../src/lib/assistant';

function expectGrounded(answer: AssistantAnswer) {
  expect(answer.headline.length).toBeGreaterThan(0);
  expect(answer.citations.length).toBeGreaterThan(0);
  for (const citation of answer.citations) {
    expect(citation.sourceId.length).toBeGreaterThan(0);
    expect(citation.locator.length).toBeGreaterThan(0);
    expect(citation.url).toMatch(/^https:\/\//);
  }
}

describe('retrieval and provenance', () => {
  it('directs report and droplet questions to the separate Research Library', () => {
    for (const question of ['How does FLEX differ from BASS-II?', 'What does the BASS-II summary report say about pressure?']) {
      const result = ask(question);
      expect(result.grade).toBe('absent');
      expect(result.claims ?? []).toHaveLength(0);
      expect(result.page?.href).toBe('#/atlas?view=research');
    }
  });
  it('abstains from total pressure while stating the exact coverage', () => {
    const answer = ask('What pressure was BASS-II run at?');
    expect(answer.grade).toBe('absent');
    expect(answer.headline).toContain('0 of 131');
    expect(answer.paragraphs.join(' ')).toContain('lack a total-pressure column');
    expect(answer.bullets.join(' ')).toContain('No cabin pressure was substituted');
    expectGrounded(answer);
    expect(answer.citations.map((citation) => citation.sourceId)).toEqual(expect.arrayContaining(['PSI-25', 'PSI-98']));
  });

  it('never invents a numeric pressure for the corpus or a record', () => {
    const corpusAnswer = ask('What pressure was BASS-II run at?');
    const recordAnswer = ask('What pressure did BASS2-B1 run at?');
    for (const answer of [corpusAnswer, recordAnswer]) {
      const text = [answer.headline, ...answer.paragraphs, ...answer.bullets].join(' ');
      expect(text).not.toMatch(/\b(?:14\.7|10\.2|4\.3)\s*(?:psi|psia)\b/i);
      expect(answer.grade).toBe('absent');
    }
    expect(recordAnswer.headline).toContain('No total pressure is reported for BASS2-B1');
  });

  it('answers a record oxygen question from the normalized value', () => {
    const answer = ask('What oxygen did BASS2-B1 report?');
    expect(answer.grade).toBe('direct');
    expect(answer.headline).toContain('BASS2-B1');
    expect(answer.headline).toContain('22.2');
    expect(answer.paragraphs.join(' ')).toContain('Total pressure is not reported');
    expectGrounded(answer);
    expect(answer.citations[0].sourceId).toBe('PSI-25');
  });

  it('separates investigation-level microgravity from partial-gravity evidence', () => {
    const answer = ask('Does the corpus include partial-gravity data?');
    expect(answer.grade).toBe('absent');
    expect(answer.headline).toContain('0 of 131');
    expect(answer.headline).toContain('partial-gravity records: 0');
    expect(answer.paragraphs.join(' ')).toContain('no partial-gravity combustion data');
    expect(answer.bullets.join(' ')).toContain('LUCI flew at 11 RPM');
    expectGrounded(answer);
    expect(answer.citations.map((citation) => citation.sourceId)).toEqual(
      expect.arrayContaining(['CHALLENGE-2026', 'NTRS-20250010653']),
    );
  });

  it('treats LUCI as context, not a structured record', () => {
    const answer = ask('What did LUCI find?');
    expect(answer.grade).toBe('context');
    expect(answer.headline).toContain('not a PSI experiment record');
    expect(answer.bullets.join(' ')).toContain('11 RPM');
    expect(answer.paragraphs.join(' ')).toContain('0.92 mm/s');
    expectGrounded(answer);
  });

  it('refuses material-safety and certification questions', () => {
    const answer = ask('Is PMMA safe in a lunar cabin?');
    expect(answer.grade).toBe('out-of-scope');
    expect(answer.headline).toContain('does not predict fire risk or certify materials');
    expect(answer.bullets.join(' ')).toContain('No material is labelled safe or unsafe');
    expect(answer.paragraphs.join(' ')).toContain('cannot be supported by these records');
    expectGrounded(answer);
  });

  it('answers comparison questions with blockers, not a score', () => {
    const answer = ask('Compare BASS-II and Saffire-I.');
    expect(answer.grade).toBe('absent');
    expect(answer.headline).toContain('cannot be treated as directly comparable');
    expect(answer.bullets.join(' ')).toContain('Pressure unknown for both sides');
    expect(answer.paragraphs.join(' ')).toContain('not a controlled experimental comparison');
    expect(answer.trace.join(' ')).toContain('Returned blockers instead of a similarity score');
    expectGrounded(answer);
  });

  it('lists the retained suspect records and their flags', () => {
    const answer = ask('Which records are flagged suspect?');
    expect(answer.grade).toBe('direct');
    expect(answer.headline).toContain('4 records');
    expect(answer.headline).toContain('None were corrected or discarded');
    for (const id of ['BASS2-P22b', 'BASS2-T28b', 'BASS2-T9', 'BASS2-T18']) {
      expect(answer.bullets.join(' ')).toContain(id);
    }
    expect(answer.bullets.join(' ')).toContain('Final O2 exceeds initial');
    expectGrounded(answer);
  });

  it('states missing fields separately from measured zeros', () => {
    const answer = ask('What is missing from the corpus?');
    expect(answer.grade).toBe('direct');
    expect(answer.headline).toContain('absent across the corpus');
    expect(answer.paragraphs.join(' ')).toContain('not zeros');
    expect(answer.bullets.join(' ')).toContain('Total pressure: 0 of 131');
    expect(answer.bullets.join(' ')).toContain('Standardized outcome: 0 of 131');
    expectGrounded(answer);
  });

  it('abstains on an unsupported question instead of generating an answer', () => {
    const answer = ask('What is the airspeed of an unladen swallow?');
    expect(answer.grade).toBe('absent');
    expect(answer.headline).toContain('I can’t answer that from the bundled corpus');
    expect(answer.trace.join(' ')).toContain('Abstained instead of generating an answer');
    expectGrounded(answer);
  });

  it('extracts a record by test number and still grounds the answer', () => {
    const answer = ask('What flow did B1 report?');
    expect(answer.grade).toBe('direct');
    expect(answer.headline).toContain('BASS2-B1');
    expect(answer.headline).toContain('5 cm/s');
    expectGrounded(answer);
  });

  it('exports an answer with citations and the no-model statement', () => {
    const text = answerToText(ask('What oxygen did BASS2-B1 report?'));
    expect(text).toContain('Sources:');
    expect(text).toContain('PSI-25');
    expect(text).toContain('No external model was called');
  });
});


describe('specific quantity and named-source routing', () => {
  it.each([
    ['What burn time did SAFFIRE1-S2 report?', '70 s'],
    ['What ignition power did SAFFIRE1-S1 report?', '182 W'],
    ['What ignition time did SAFFIRE1-S1 report?', '8 s'],
  ])('answers %s as reported evidence', (question, value) => {
    const answer = ask(question);
    expect(answer.grade).toBe('direct');
    expect(answer.headline).toContain(value);
    expect(answer.citations[0].sourceId).toBe('PSI-98');
  });
  it('does not fabricate a missing duration', () => {
    expect(ask('What burn time did BASS2-B1 report?').grade).toBe('absent');
  });
  it.each(['What did LUCI find about lunar gravity?', 'What did LUCI report about lunar-gravity spread?'])(
    'retrieves named LUCI context for %s', (question) => {
      const answer = ask(question);
      expect(answer.grade).toBe('context');
      expect(answer.paragraphs.join(' ')).toContain('0.92 mm/s');
      expect(answer.citations.some((citation) => citation.sourceId === 'NTRS-20250010653')).toBe(true);
    },
  );
  it('keeps safety refusal ahead of named-source retrieval', () => {
    expect(ask('Can LUCI certify PMMA safe on the Moon?').grade).toBe('out-of-scope');
  });
});
