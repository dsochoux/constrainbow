original_file = 'short-commons.txt'
filtered_file = '4-letter-words.txt'

with open(original_file, 'r') as infile, open(filtered_file, 'w') as outfile:
    for line in infile:
        word = line.strip()
        if len(word) == 4:
            outfile.write(word + '\n')

# file = '5-letter-commons.txt'

count = 0
with open(filtered_file, 'r') as f:
    for word in f:
        count += 1

print(count)