# import sqlite3

# db_path = "../database.db"

# conn = sqlite3.connect(db_path)
# cursor = conn.cursor()

# cursor.execute('''
# CREATE TABLE IF NOT EXISTS words (
#     id INTEGER PRIMARY KEY AUTOINCREMENT,
#     first_letter TEXT NOT NULL,
#     second_letter TEXT NOT NULL,
#     third_letter TEXT NOT NULL,
#     fourth_letter TEXT NOT NULL,
#     fifth_letter TEXT NOT NULL
# )
# ''')

# with open("../words.txt", "r") as f:
#     for line in f:
#         cursor.execute('''
#         INSERT INTO words (first_letter, second_letter, third_letter, fourth_letter, fifth_letter)
#         VALUES (?, ?, ?, ?, ?)
#         ''', tuple(line.strip()))

# conn.commit()
# conn.close()

# print(f"database initialized at path {db_path}")