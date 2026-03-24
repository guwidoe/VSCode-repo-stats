import * as fs from 'fs/promises';

export interface FixtureMarker<TFixture> {
  schemaVersion: number;
  targetName: string;
  fixture: TFixture;
}

export async function readFixtureMarker<TFixture>(
  markerPath: string
): Promise<FixtureMarker<TFixture>> {
  const markerRaw = await fs.readFile(markerPath, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(markerRaw);
  } catch (error) {
    throw new Error(
      `Failed to parse benchmark fixture marker ${markerPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isFixtureMarkerShape<TFixture>(parsed)) {
    throw new Error(`Benchmark fixture marker ${markerPath} has an invalid shape.`);
  }

  return parsed;
}

export async function writeFixtureMarker<TFixture>(
  markerPath: string,
  marker: FixtureMarker<TFixture>
): Promise<void> {
  await fs.writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

export function fixtureMarkerMatches<TFixture>(options: {
  marker: FixtureMarker<TFixture>;
  schemaVersion: number;
  targetName: string;
  fixture: TFixture;
}): boolean {
  return (
    options.marker.schemaVersion === options.schemaVersion &&
    options.marker.targetName === options.targetName &&
    JSON.stringify(options.marker.fixture) === JSON.stringify(options.fixture)
  );
}

function isFixtureMarkerShape<TFixture>(value: unknown): value is FixtureMarker<TFixture> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<FixtureMarker<TFixture>>;
  return (
    typeof candidate.schemaVersion === 'number' &&
    typeof candidate.targetName === 'string' &&
    candidate.fixture !== undefined
  );
}
