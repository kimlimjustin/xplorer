{
  "targets": [
    {
      "target_name": "module",
      "product_extension": "node",
      "include_dirs" : [ "src/Lib/extracticon" ],
      "conditions": [
        ['OS=="win"', {
          'cflags': [
            '/EHa',
          ],
        },],
      ],
      "sources": [
        "src/Lib/extracticon/module.cc"
      ]
    }
  ]
}