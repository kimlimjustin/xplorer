{
  "targets": [
    {
      "target_name": "module",
      "product_extension": "node",
      "include_dirs" : [ "lib/exe-icon-extractor" ],
      "conditions": [
        ['OS=="win"', {
          'cflags': [
            '/EHa',
          ],
        },],
      ],
      "sources": [
        "lib/exe-icon-extractor/exe-icon-extractor.cc"
      ]
    }
  ]
}