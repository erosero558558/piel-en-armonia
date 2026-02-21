<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

// We need to include the file that defines normalize_review.
// Based on grep, it is likely in api-lib.php or one of its includes.
// Since api-lib.php includes everything, we require it.
require_once __DIR__ . '/../../api-lib.php';

class ApiLibTest extends TestCase
{
    public function testHappyPath(): void
    {
        $input = [
            'id' => 123,
            'name' => 'John Doe',
            'rating' => 4,
            'text' => 'Great service!',
            'date' => '2023-10-27T10:00:00+00:00',
            'verified' => true
        ];
        $result = normalize_review($input);

        $this->assertSame(123, $result['id']);
        $this->assertSame('John Doe', $result['name']);
        $this->assertSame(4, $result['rating']);
        $this->assertSame('Great service!', $result['text']);
        $this->assertSame('2023-10-27T10:00:00+00:00', $result['date']);
        $this->assertTrue($result['verified']);
    }

    public function testRatingLowerBound(): void
    {
        $input = ['rating' => 0];
        $result = normalize_review($input);
        $this->assertSame(1, $result['rating']);

        $input = ['rating' => -5];
        $result = normalize_review($input);
        $this->assertSame(1, $result['rating']);
    }

    public function testRatingUpperBound(): void
    {
        $input = ['rating' => 6];
        $result = normalize_review($input);
        $this->assertSame(5, $result['rating']);

        $input = ['rating' => 100];
        $result = normalize_review($input);
        $this->assertSame(5, $result['rating']);
    }

    public function testMissingRatingDefaults(): void
    {
        $input = [];
        $result = normalize_review($input);
        $this->assertSame(1, $result['rating']);
    }

    public function testNameTruncation(): void
    {
        $longName = str_repeat('a', 105);
        $input = ['name' => $longName];
        $result = normalize_review($input);
        $this->assertEquals(100, mb_strlen($result['name']));
        $this->assertEquals(substr($longName, 0, 100), $result['name']);
    }

    public function testTextTruncation(): void
    {
        $longText = str_repeat('b', 2005);
        $input = ['text' => $longText];
        $result = normalize_review($input);
        $this->assertEquals(2000, mb_strlen($result['text']));
        $this->assertEquals(substr($longText, 0, 2000), $result['text']);
    }

    public function testVerifiedBooleanParsing(): void
    {
        $cases = [
            ['verified' => 'true', 'expected' => true],
            ['verified' => 'false', 'expected' => false],
            ['verified' => '1', 'expected' => true],
            ['verified' => 1, 'expected' => true],
            ['verified' => null, 'expected' => true], // Missing defaults to true? logic says yes
        ];

        foreach ($cases as $case) {
            $input = isset($case['verified']) ? ['verified' => $case['verified']] : [];
            $result = normalize_review($input);
            $this->assertSame($case['expected'], $result['verified'], "Failed for input: " . json_encode($input));
        }
    }

    public function testMissingIdGeneratesOne(): void
    {
        $input = [];
        $result = normalize_review($input);
        $this->assertIsInt($result['id']);
        $this->assertGreaterThan(0, $result['id']);
    }

    public function testMissingDateUsesCurrent(): void
    {
        $input = [];
        $result = normalize_review($input);
        $this->assertNotEmpty($result['date']);
        // Check roughly ISO 8601
        $this->assertStringContainsString('-', $result['date']);
        $this->assertStringContainsString(':', $result['date']);
    }

    public function testXssHandling(): void
    {
        $input = ['text' => '<script>alert(1)</script>'];
        $result = normalize_review($input);
        // normalize_review uses sanitize_xss which escapes HTML
        $this->assertSame('&lt;script&gt;alert(1)&lt;/script&gt;', $result['text']);
    }
}
