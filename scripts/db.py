import sqlite3

db_path = "database.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# cursor.execute("DELETE FROM words")  # Clear existing data

cursor.execute('''
CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_letter TEXT NOT NULL,
    second_letter TEXT NOT NULL,
    third_letter TEXT NOT NULL,
    fourth_letter TEXT NOT NULL,
    fifth_letter TEXT NOT NULL
)
''')

with open("./word_files/words.txt", "r") as f:
    for line in f:
        if len(line.strip()) != 5:
            print('oh no!')
        try:
            cursor.execute('''
            INSERT INTO words (first_letter, second_letter, third_letter, fourth_letter, fifth_letter)
            VALUES (?, ?, ?, ?, ?)
            ''', tuple(line.strip()))
        except:
            print("bad")

# cursor.execute('''
# CREATE TABLE IF NOT EXISTS reported_missing_words (
#     id INTEGER PRIMARY KEY AUTOINCREMENT,
#     word TEXT NOT NULL
# )
# ''')

conn.commit()
conn.close()

# print(f"database initialized at path {db_path}")