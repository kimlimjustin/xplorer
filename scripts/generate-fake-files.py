# Generate n fake files with the structure of '../lib/files.json' and random size in '../fake-files' directory
# Usage: python3 generate-fake-files.py <number of files>

import os
import sys
import json
import random

structure = json.load(open('./lib/files.json'))

directory = './fake-files'
number_of_files = int(sys.argv[1])

for i in range(number_of_files):
    if not os.path.exists(directory):
        os.makedirs(directory)
    try:
        to_generate = random.choice(['fileNames', 'extensions'])
        if to_generate == 'fileNames':
            file_name = random.choice(random.choice(structure)[to_generate])
        else:
            random_string = ''.join(random.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(10))
            file_name = random_string + '.' + random.choice(random.choice(structure)[to_generate])
        file_size = random.randint(1, 10000)
        file_path = os.path.join(directory, file_name)
        with open(file_path, 'w') as f:
            f.write('\n' * file_size)
    except Exception:
        file_name = ''.join(random.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(10))
        file_path = os.path.join(directory, file_name)
        file_size = random.randint(1, 10000)
        with open(file_path, 'w') as f:
            f.write('\n' * file_size)